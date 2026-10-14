<?php
/**
 * Copyright (c) 2026 Iman Aboheydary. MIT License, see LICENSE.
 *
 * Fixture-only child of Hyvä default that renders right to left (store view "ar"), for OpenFilter's RTL tests.
 */
declare(strict_types=1);

use Magento\Framework\Component\ComponentRegistrar;

ComponentRegistrar::register(ComponentRegistrar::THEME, 'frontend/OpenFilterFixture/hyva-rtl', __DIR__);
