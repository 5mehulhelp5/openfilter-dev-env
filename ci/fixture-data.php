<?php
/**
 * Copyright (c) 2026 Iman Aboheydary. MIT License, see LICENSE.
 *
 * Fixture data OpenFilter's tests rely on, on top of Magento's sample data (idempotent, run from the Magento root):
 * - a German store view "de" (locale de_DE) with German colour option labels, umlauts included (slug tests);
 * - store view "hyva15" with the local Hyvä 1.5.2 copy (bin/install-hyva15; only where that theme is registered)
 *   and store view "ar" (ar_SA) with the right-to-left child theme OpenFilterFixture/hyva-rtl (M3 storefront tests),
 *   both with the default store view's reviews and rating summaries (same catalog, another theme);
 * - catalog price rules that give NOT LOGGED IN, General, Wholesale and Retailer different prices (price slider,
 *   on-sale filter and Varnish customer-group variation tests).
 * Usage: php <path>/fixture-data.php
 */
declare(strict_types=1);

use Magento\CatalogRule\Api\CatalogRuleRepositoryInterface;
use Magento\CatalogRule\Api\Data\RuleInterfaceFactory;
use Magento\Framework\App\Bootstrap;
use Magento\Framework\App\Config\Storage\WriterInterface;
use Magento\Framework\App\ResourceConnection;
use Magento\Store\Model\ResourceModel\Store as StoreResource;
use Magento\Store\Model\StoreFactory;
use Magento\Store\Model\StoreManagerInterface;

require getcwd() . '/app/bootstrap.php';
$bootstrap = Bootstrap::create(BP, $_SERVER);
$om = $bootstrap->getObjectManager();
$om->get(\Magento\Framework\App\State::class)->setAreaCode('adminhtml');

// 1. Store views: German, Hyvä 1.5.2 (local copy), right to left.
$storeManager = $om->get(StoreManagerInterface::class);
$db = $om->get(ResourceConnection::class)->getConnection();
$configWriter = $om->get(WriterInterface::class);
$themeId = static function (string $path) use ($db): int {
    return (int) $db->fetchOne(
        $db->select()->from($db->getTableName('theme'), 'theme_id')
            ->where('area = ?', 'frontend')->where('theme_path = ?', $path)
    );
};
$storeView = static function (string $code, string $name, int $sortOrder, string $locale, int $theme) use (
    $om,
    $storeManager,
    $configWriter
): int {
    if (!isset($storeManager->getStores(false, true)[$code])) {
        $default = $storeManager->getDefaultStoreView();
        $store = $om->get(StoreFactory::class)->create();
        $store->setCode($code)->setName($name)->setWebsiteId((int) $default->getWebsiteId())
            ->setGroupId((int) $default->getStoreGroupId())->setSortOrder($sortOrder)->setIsActive(1);
        $om->get(StoreResource::class)->save($store);
        $storeManager->reinitStores();
        echo "store view $code created\n";
    }
    $id = (int) $storeManager->getStore($code)->getId();
    $configWriter->save('general/locale/code', $locale, 'stores', $id);
    if ($theme > 0) {
        $configWriter->save('design/theme/theme_id', (string) $theme, 'stores', $id);
    }
    return $id;
};
$deId = $storeView('de', 'Deutsch', 10, 'de_DE', 0);
if ($hyva15 = $themeId('OpenFilterFixture/hyva-1-5-2')) {
    $storeView('hyva15', 'Hyvä 1.5.2', 20, 'en_US', $hyva15);
}
if ($rtl = $themeId('OpenFilterFixture/hyva-rtl')) {
    $storeView('ar', 'Arabic (right to left)', 30, 'ar_SA', $rtl);
}

// 2. German colour option labels.
$german = [
    'Black' => 'Schwarz', 'Blue' => 'Blau', 'Brown' => 'Braun', 'Gray' => 'Grau', 'Green' => 'Grün',
    'Lavender' => 'Lavendel', 'Multi' => 'Mehrfarbig', 'Orange' => 'Orange', 'Purple' => 'Lila', 'Red' => 'Rot',
    'White' => 'Weiß', 'Yellow' => 'Gelb', 'Beige' => 'Beige', 'Rosé' => 'Rosé',
];
$optionTable = $db->getTableName('eav_attribute_option');
$valueTable = $db->getTableName('eav_attribute_option_value');
$attributeId = (int) $db->fetchOne(
    $db->select()->from(['a' => $db->getTableName('eav_attribute')], 'attribute_id')
        ->join(['t' => $db->getTableName('eav_entity_type')], 't.entity_type_id = a.entity_type_id', [])
        ->where('t.entity_type_code = ?', 'catalog_product')->where('a.attribute_code = ?', 'color')
);
$options = $db->fetchPairs(
    $db->select()->from(['o' => $optionTable], ['option_id'])
        ->join(['v' => $valueTable], 'v.option_id = o.option_id AND v.store_id = 0', ['value'])
        ->where('o.attribute_id = ?', $attributeId)
);
$labelled = 0;
foreach ($options as $optionId => $label) {
    if (!isset($german[$label])) {
        continue;
    }
    $db->delete($valueTable, ['option_id = ?' => (int) $optionId, 'store_id = ?' => $deId]);
    $db->insert($valueTable, ['option_id' => (int) $optionId, 'store_id' => $deId, 'value' => $german[$label]]);
    $labelled++;
}
echo "German colour labels: $labelled\n";

// 3. Catalog price rules per customer group (0 NOT LOGGED IN gets none).
$rules = ['General' => [1, 10.0], 'Wholesale' => [2, 20.0], 'Retailer' => [3, 15.0]];
$repository = $om->get(CatalogRuleRepositoryInterface::class);
$factory = $om->get(RuleInterfaceFactory::class);
$websiteId = (int) $storeManager->getDefaultStoreView()->getWebsiteId();
foreach ($rules as $group => [$groupId, $percent]) {
    $name = "OpenFilter fixture: $group -$percent%";
    $exists = (int) $db->fetchOne(
        $db->select()->from($db->getTableName('catalogrule'), 'COUNT(*)')->where('name = ?', $name)
    );
    if ($exists) {
        continue;
    }
    $rule = $factory->create();
    $rule->setName($name)->setIsActive(1)->setCustomerGroupIds([$groupId])->setWebsiteIds([$websiteId])
        ->setSimpleAction('by_percent')->setDiscountAmount($percent)->setStopRulesProcessing(0)->setSortOrder(0);
    $repository->save($rule);
    echo "rule created: $name\n";
}

// 4. OpenFilter's built-in filters rating, on sale and new switched on (defaults: off), when OpenFilter is installed.
// In stock stays off: the fixture hides out-of-stock products, so the filter would have nothing to do.
$builtinTable = $db->getTableName('openfilter_builtin');
if ($db->isTableExists($builtinTable)) {
    $switched = $db->update($builtinTable, ['is_active' => 1], ['code IN (?)' => ['rating', 'sale', 'new']]);
    echo "OpenFilter built-ins switched on: $switched\n";
    // A merchant's typical SEO choice (M4): pages filtered by exactly one colour may be indexed.
    $colorId = (int) $db->fetchOne(
        $db->select()->from($db->getTableName('eav_attribute'), 'attribute_id')
            ->where('attribute_code = ?', 'color')->where('entity_type_id = ?', 4)
    );
    $indexable = $db->update($db->getTableName('openfilter_attribute'), ['seo_indexable' => 1], ['attribute_id = ?' => $colorId]);
    echo "OpenFilter colour indexable: $indexable\n";
}

// 5. The default store view's reviews and rating summaries also on hyva15 and ar (the rating filter and the stars on
// product cards are per store view; these store views show the same catalog with another theme).
$defaultStoreId = (int) $storeManager->getDefaultStoreView()->getId();
foreach (['hyva15', 'ar'] as $code) {
    if (!isset($storeManager->getStores(false, true)[$code])) {
        continue;
    }
    $id = (int) $storeManager->getStore($code)->getId();
    $copies = [
        'review_store' => ['review_id'],
        'rating_store' => ['rating_id'],
        'review_entity_summary' => ['entity_pk_value', 'entity_type', 'reviews_count', 'rating_summary'],
        'rating_option_vote_aggregated' => ['rating_id', 'entity_pk_value', 'vote_count', 'vote_value_sum', 'percent',
            'percent_approved'],
    ];
    foreach ($copies as $table => $columns) {
        $table = $db->getTableName($table);
        $db->delete($table, ['store_id = ?' => $id]);
        $select = $db->select()->from($table, array_merge($columns, ['store_id' => new \Zend_Db_Expr((string) $id)]))
            ->where('store_id = ?', $defaultStoreId);
        $db->query($db->insertFromSelect($select, $table, array_merge($columns, ['store_id'])));
    }
    echo "reviews and ratings copied to $code\n";
}
