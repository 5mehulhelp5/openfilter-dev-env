<?php
/**
 * Copyright (c) 2026 Iman Aboheydary. MIT License, see LICENSE.
 *
 * Fixture-only module: tells Hyvä that the local Hyvä 1.5.2 copy (bin/install-hyva15) is a Hyvä base theme.
 */
declare(strict_types=1);

use Magento\Framework\Component\ComponentRegistrar;

ComponentRegistrar::register(ComponentRegistrar::MODULE, 'OpenFilterFixture_Themes', __DIR__);
