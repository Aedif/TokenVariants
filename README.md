
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

### Search Filter Settings

!["Filter Settings"](./docs/filter_settings.png)

There are 3 types of searches. Portrait, Token, and General (Token+Portrait). Each of these searches can be configured with filters to exclude files that include or exclude certain text, or match some regular expression.

### Randomizer Settings
!["Randomizer Settings"](./docs/randomizer_settings.png)

If enabled will automatically assign random images to Actor portraits and Tokens. The images will be chosen from searches performed using the actor/token name and/or keywords. Additionally you may also include images shared through the TokenHUD side menu.

### Pop-up Settings

#### Disable separate pop-ups for Portrait and Token art

When enabled two separate pop-ups will be displayed upon Actor/Token creation, first to select the portrait art and second to select the Token art.

#### Disable prompt between Portrait and Token art select

Will disable the confirmation prompt displayed when the **Disable separate pop-ups for Portrait and Token art** is enabled. Two pop-ups will always be shown.

#### Disable right-click pop-up on the character sheet portrait

Will disable the Art Select window popping up when right-clicking the portrait on the character sheet.

#### Disable Automatic Pop-ups

Automatic pop-ups can be disabled for type of actor (PC, NPC, Vehicle) and the type of event (Actor Create, Token Create, Token Copy+Paste).

### Token HUD Settings

#### Enable Token HUD Button
Enables extra button in the Token HUD which brings up all of the found art in a small preview to the right: 

!["Token Hud"](./docs/token_hud.png)

This art can be shared with players by right-clicking on the images, which makes them available in the Token HUD side menu without the need to enable the **Enable Token HUD button for everyone** setting. Shared artwork is indicated by a green arrow.

By default the side menu uses the token's name as the search criteria. However a custom search can be performed by right-clicking on the new Token HUD button while the side menu is open:

!["Token Hud Search"](./docs/token_hud_search.png)

### Enable Token HUD button for everyone

If checked will allow all players to access the new Token HUD button. Note that this may potentially reveal art that the players are not supposed to see. For a more controlled way of allowing your players to switch between different variants consider "sharing" it via right-clicking the art in the new Token HUD menu.

#### Always show HUD Button

If enabled the HUD Button will be shown even when no matches have been found.

#### Display as image?

Controls whether the art in the preview is rendered as images or a list of file names.

#### Opacity of token preview

Controls the opacity of the tokens in the preview before being hovered over.

#### Update Actor portrait

When enabled selecting an image from the Token HUD will also apply it to the character sheet.

### Search by Keyword

When enabled the art search will be done using both the Actor/Token full name as well as individual words within the name:

!["Keyword Search"](./docs/keyword_search.png)

### Excluded Keywords

Words within this list will be excluded from the keywords search. By default "and,for" are ignored in token/actor names.

### Actor Directory Popup key

Controls the key used to trigger a pop-up when dragging in an actor from the 'Actor Directory'.

### Match name to folder

When enabled all searches will be done both on the file names as well as the file path:

e.g. '**Dragon**' will match "token_art/**dragon**s/red/avatar.png" as well as "tokens/monsters/Red**Dragon**.png"

## Image configuration

Images displayed in the **Art Select** window or the **TokenHUD** side menu can be shift+left-clicked to open a configuration pop-up:

!["Image Configuration"](./docs/image_config.png)

Once configured these settings will be applied to the token every time you switch to these images using the **Token Variant Art** module.

## Installation
To install, import this [manifest](https://raw.githubusercontent.com/Aedif/TokenVariants/master/module.json) into the module browser or search for 'Token Variant Art'.

## API

### **showArtSelect(search, {callback = null, searchType='both', tokenConfig={}}={})**

Displays the art select window.

Parameters:
 * **{string}** **search** The text to be used as the search criteria
 * **{object}** Options which customize the search
    * {Function[]} [callback] Function to be called with the user selected image path
    * {string} [searchType] (token|portrait|both) Controls filters applied to the search results
    * {Token|object} [tokenConfig] Used to source default token image config from such as (width, height, scale, etc.)

e.g. 
* game.modules.get('token-variants').api.showArtSelect("")
* game.modules.get('token-variants').api.showArtSelect("dragon", {callback: (selectedImg) => console.log(selectedImg)})

### **doImageSearch(search, {searchType = 'both', ignoreKeywords = false, simpleResults = false, callback = null}={})**

Performs an image search and returns the results.

Parameters:
 * **{string}** **search**: Text to be used as the search criteria
 * **{object}** Options which customize the search
    * {string} [searchType] (token|portrait|both) Controls filters applied to the search results
    * {Boolean} [ignoreKeywords] Ignores keywords search setting
    * {Boolean} [simpleResults] Results will be returned as an array of all image paths found
    * {Boolean} [callback] Function to be called with the found images
 * **returns**: {Map<string, Map<string, Map<string, Array<string>>>>|Array<String>|null} All images found split by original criteria and keywords

e.g. 
* game.modules.get('token-variants').api.doImageSearch("Dragon")
* game.modules.get('token-variants').api.doImageSearch("Dragon", {simpleResults: true})

### **doRandomSearch(search, { searchType='both', actor=null, callback=null } = {})**

Performs a random image search and returns the results.

Parameters:
 * **search**: Text to be used as the search criteria
 * **{object}** Options which customize the search
    * {string} [searchType] (token|portrait|both) Controls filters applied to the search results
    * {Actor} [actor] Used to retrieve 'shared' images from if enabled in the Randomizer Settings
    * {Function[]} [callback] Function to be called with the random image
 * **returns**: {Array<string>|null} Image path and name

e.g. 
* game.modules.get('token-variants').api.doRandomSearch("Goblin")
* game.modules.get('token-variants').api.doRandomSearch("Goblin", {callback: (result) => console.log(result)})

## **cacheTokens()**

When called will trigger the refresh of the token cache.
