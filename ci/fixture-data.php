<?php
/**
 * Copyright (c) 2026 Iman Aboheydary. MIT License, see LICENSE.
 *
 * Fixture data OpenFilter's tests rely on, on top of Magento's sample data (idempotent, run from the Magento root):
 * - a German store view "de" (locale de_DE) with German colour option labels, umlauts included (slug tests);
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

// 1. German store view.
$storeManager = $om->get(StoreManagerInterface::class);
$stores = $storeManager->getStores(false, true);
if (!isset($stores['de'])) {
    $default = $storeManager->getDefaultStoreView();
    $store = $om->get(StoreFactory::class)->create();
    $store->setCode('de')->setName('Deutsch')->setWebsiteId((int) $default->getWebsiteId())
        ->setGroupId((int) $default->getStoreGroupId())->setSortOrder(10)->setIsActive(1);
    $om->get(StoreResource::class)->save($store);
    $storeManager->reinitStores();
    echo "store view de created\n";
}
$deId = (int) $storeManager->getStore('de')->getId();
$om->get(WriterInterface::class)->save('general/locale/code', 'de_DE', 'stores', $deId);

// 2. German colour option labels.
$german = [
    'Black' => 'Schwarz', 'Blue' => 'Blau', 'Brown' => 'Braun', 'Gray' => 'Grau', 'Green' => 'Grün',
    'Lavender' => 'Lavendel', 'Multi' => 'Mehrfarbig', 'Orange' => 'Orange', 'Purple' => 'Lila', 'Red' => 'Rot',
    'White' => 'Weiß', 'Yellow' => 'Gelb', 'Beige' => 'Beige', 'Rosé' => 'Rosé',
];
$db = $om->get(ResourceConnection::class)->getConnection();
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
