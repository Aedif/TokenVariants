
![GitHub Latest Version](https://img.shields.io/github/v/release/Aedif/TokenVariants?sort=semver)
![GitHub Latest Release](https://img.shields.io/github/downloads/Aedif/TokenVariants/latest/token-variants.zip)
![GitHub All Releases](https://img.shields.io/github/downloads/Aedif/TokenVariants/token-variants.zip)
# Token Variant Art

This module searches a customisable list of directories and displays art variants for tokens/actors through pop-ups and a new Token HUD button. Variants can be individually shared with players allowing them to switch out their token art on the fly.


https://user-images.githubusercontent.com/7693704/121926941-69aff780-cd36-11eb-864b-b2a9640baeea.mp4



The search is done using the Actor's name, and will ignore special characters, case, or spaces in the files

e.g.

- '**Mage**' will match: **09_mage.png**, **red-MAGE-64.png**, **mage-s_fire.jpg**
- '**Half-Red Dragon Veteran**' will match: **HalfRedDragonVeteran.png**, **hAlF_rEd_dRAgon-VETERAN.png**


The only requirement is that the full name of the Actor is present in the file name. So the following would not match:

- '**Mage**' will NOT match: **mag03.png**, **09_ma_abc_ge.png**
- '**Half-Red Dragon Veteran**' will NOT match **RedDragon.png**, **HalfRedDragon.png**


The 'Art Select' screen can also be opened up from the Actor Sheet by right-clicking on the portrait or the 'Token Configuration' window's 'Image' tab. A new button is added right next to the File Picker:

!["Token Configuration Button"](./docs/token_config_button.png)

## Settings
### Search Paths

The directories that will be scanned for art can be set here. All of the sub-directories will be searched as well so feel free to organise your art as you wish.

!["Search Paths Config"](./docs/search_paths.png)

The root of these paths is assumed to be Foundry VTT's local Data folder. The same folder where you would find your worlds, systems, and modules.

By default 'Token Variants' will attempt to search [Caeora's Maps, Tokens, and Assets](https://foundryvtt.com/packages/caeora-maps-tokens-assets) asset folder if installed.

In addition to local paths you can also add s3 buckets, ForgeVTT asset folders, and Rolltables as image sources:

* To specify a path for a [configured](https://foundryvtt.com/article/aws-s3/) AWS S3 bucket use the following format: **s3:{bucket-name}:{path}**
* For your ForgeVTT asset folder the format is as follows: **https://assets.forge-vtt.com/{userId}/path/to/token/art**
* Rolltables can be added using: **rolltable:{rolltable name}**

By default the module will scan these sources only when the world is loaded or when the **Search Paths** settings have changed. If new art is added while the world is still open it will not be found by the module. Disabling '**Cache**' will force the scan to be done every time an art search is performed at a potentially significant cost to speed at which the art is displayed to the user depending on the number of images. 

For small directories and rolltables the performance hit is negligible so experiment with the convenience/performance trade-offs until you find the right balance.

### Filter Settings

!["Filter Settings"](./docs/filter_settings.png)

There are 3 types of searches. Portrait, Token, and General (Token+Portrait). Each of these searches can be configured with filters to exclude files that include or exclude certain text, or match some regular expression.

### Token HUD Settings

A SubMenu with the following settings:

#### Enable Token HUD Button
Enables extra button in the Token HUD which brings up all of the found art in a small preview to the right: 

!["Token Hud"](./docs/token_hud.png)

This art can be shared with players by right-clicking on the images, which makes them available in the Token HUD side menu without the need to enable the **Enable Token HUD button for everyone** setting. Shared artwork is indicated by a green arrow.

By default the side menu uses the token's name as the search criteria. However a custom search can be performed by right-clicking on the new Token HUD button while the side menu is open:

!["Token Hud Search"](./docs/token_hud_search.png)

#### Always show HUD Button

If enabled the HUD Button will be shown even when no matches have been found.

#### Display as image?

Controls whether the art in the preview is rendered as images or file names.

#### Opacity of token preview

Controls the opacity of the tokens in the preview before being hovered over.

### Enable Token HUD button for everyone

If checked will allow all players to access the new Token HUD button. Note that this may potentially reveal art that the players are not supposed to see. For a more controlled way of allowing your players to switch between different variants consider "sharing" it via right-clicking the art in the new Token HUD menu.

### Disable Caching

By default the module will search the directories defined in 'Variant art search paths' only when the world is loaded or when the module settings have changed. If new art is added while the world is still open it will not be found by the module. 'Disable Caching' will force the search to be performed every time a new actor is created at a significant cost to speed at which the art is displayed to the user.

### Disable Automatic Popups

If checked will prevent automatic popups from being triggered upon Actor creation. The popup can still be brought up if Ctrl key is held while dragging the Token/Actor.

### Filter by D&D 5e Monster (SRD)

Can be enabled if you want variant art to not be retrieved for actors with names not found in D&D 5e Monster (SRD) list.

### Search by Keyword

When enabled the art search will be done using both the Actor/Token full name as well as individual words within the name:

!["Keyword Search"](./docs/keyword_search.png)
### Excluded Keywords

Words within this list will be excluded from the keywords search:
!["Excluded Keywords"](./docs/excluded_keywords.png)

### Actor Directory Popup key

Controls the key used to trigger a popup when dragging an actor from the 'Actor Directory'.

### Display separate pop-ups for Portrait and Token art

When enabled the Art Select pop-up will be shown twice upon actor/token creation. Once for the portrait, and then again for the token art.

### Match name to folder

When enabled all searches will be done both on the file names as well as the file path:

e.g. '**Dragon**' will match "token_art/**dragon**s/red/avatar.png" as well as "tokens/monsters/Red**Dragon**.png"

## Installation
To install, import this [manifest](https://raw.githubusercontent.com/Aedif/TokenVariants/master/module.json) into the module browser or search for 'Token Variant Art'.

## API

### **game.TokenVariants.displayArtSelect(name, callback, searchType = 'both', ignoreFilterMSRD = false)**

Displays the token art select window.

Parameters:
 * **name**: The name to be used as the search criteria
 * **callback**: function that will be called with the user selected image path as argument
 * **searchType** (token|portrait|both) which filters are to be used in the art search
 * **ignoreFilterMSRD** if set to true will ignore the filterMSRD setting

e.g. 
* game.TokenVariants.displayArtSelect("")
* game.TokenVariants.displayArtSelect("dragon", (selectedImg) => console.log(selectedImg))

## **game.TokenVariants.cacheTokens()**

When called will trigger the refresh of the token cache.
