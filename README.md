# TokenVariants

This module provides a pop-up upon token creation with all the available variants of the token art it could find in the customizable list of directories.

## Installation
To install, import this [manifest](https://raw.githubusercontent.com/Aedif/TokenVariants/master/module.json) into the module browser.

## Usage
### General usage
With the module active the pop-up will appear upon actor creation and will allow you to select the variant you wish to assign to the token:

![](./docs/art_select.gif)

### Config
The art displayed in the pop-up will be searched for in directories as defined in the 'Variant art search paths' config:

![](./docs/search_paths.png)

The root of these paths is Foundry VTT's Data folder. The same folder where you would find your worlds, systems, and modules.

By default 'Token Variants' will attempt to search [Caeora's Maps, Tokens, and Assets](https://foundryvtt.com/packages/caeora-maps-tokens-assets) asset folder if installed.