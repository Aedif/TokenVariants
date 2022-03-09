# 1.28.1

- New Token HUD setting: **IncludeKeywords in the search**
  - All art matching token's full name and individual words within the name will be shown in the Token HUD
- New setting: **Disable Cache Notifications**
  - Disabled notifications shown by the module during caching

# 1.27.1

- New Randomizer setting: **Apply Token image to Portrait**
  - Applies the random image generated on Token Create/Copy-paste to the Portrait
- New Randomizer setting: **Different images for Portrait and Token**
  - Randomizes Portrait and Token images separately
- New Randomizer setting: **Sync Portrait and Token based on image name similarity**
  - Available if **Different images for Portrait and Token** is enabled
  - Portrait/Token image will be randomly applied and then another search performed to find a counterpart image with a similar name
  - Useful if you have a setup such as **Orc_1.png** and **Orc_1\[Portrait\].png** and use the modules 'Filter' settings to distinguish between Token and Portrait images
  - **Orc_4.png** will be matched with **Orc_4\[Portrait\].png**, **Orc_3.png** with **Orc_3\[Portrait\].png** etc.

# 1.26.1

- **Compendium Mapper** setting menu added
  - Allows for automated and/or aided means of assigning images to Actors in a compendium
  - Options
    - Only include actors with missing images
    - Apply different images for Portrait and Token
    - Show current portrait/token images in the 'Art Select' window
    - Include keywords in the search
    - Re-cache images before mapping begins
  - Automation
    - Auto-apply the first found image
    - Display 'Art Select' if no image found
    - Sync Portrait and Token if only one image is missing
- **Art Select** window now support a queue
  - Instead of opening multiple instances of the window the module will now add them to the queue, opening the next search once the first image has been selected or the window closed

# 1.25.2

- Lifted restrictions on which game system can use the Status Config functionality.
- Bug fix for one for one of the settings not registering properly

# 1.25.1

- Images can now be mapped to Visibility/Combat status and Active Effects
  - Enabled via 'Enable Status Config' setting
  - Each image can be given a priority that will be enforced if multiple statuses are active
  - Due to slight differences in the way active effects are handled between different systems this functionality is currently only supported for **DnD5e** and **PF2e**. Create an issue under the project if you're interested with having support for another system.
- Customizable v9 keybindings added for Art Select popup override and Config control keys

# 1.24.1

- Fixed a v9 bug causing '**Disable Automatic Pop-ups for: On Token Copy+Paste**' to be ignored

# 1.24.0

- New setting added under 'Token HUD Settings': **Include wildcard images**
  - When enabled 'Alternate Actor Tokens' will be included in the Token HUD side menu

# 1.23.0

- Imgur galleries can now be added as image sources in the '**Search Paths**' setting
  - **imgur:galleryId** (e.g. imgur:JweWCpf)
  - Imgur paths can be automatically converted to RollTables
  - **!!!** Images will not be picked up when running from '**localhost**'

# 1.22.3

- Added a cog icon to indicate whether images have associated custom configs
- Fixed Actor Directory key conflicting with 'Ctrl+V' token paste.

# 1.22.1

- Bug fixes
  - Images not properly updating upon drag in from compendium
  - Token HUD button always shown without always show setting enabled

# 1.22.0

- ForgeVTT Asset Library paths can now be configured as **forgevtt:path/to/asset/library/folder** instead of **https://assets.forge-vtt.com/{userId}/path/to/asset/library/folder** inside the **Search Paths** setting menu. However the new preferred method of linking your asset library folders is:
- New setting added: **Forge Asset Library Paths**
  - Only available when running the game on ForgeVTT
  - Considerably faster for large folder structures compared to previous method
  - Allows GMs and regular players alike to expose their Asset Libraries to the module
  - Linked folders will be private to the user that configured it unless an API Key is entered and the path is flagged as 'Share'. API Keys can be generated via 'My Account' page.
- Exposed **updateTokenImage(...)** function through the API. Token images updated using this function will apply a custom configuration to the token if one has been setup using the module.

# 1.21.0

- Compatibility with 'Token HUD Wildcard'
  - The buttons from both modules should now properly interact and de-activate one another when clicked.
  - Added a new setting under **Token HUD Settings** to disable **Token Variant Art** button if **Token HUD Wildcard** is active and 'Randomize Wildcard Images' is checked.
- New setting under **Token HUD Settings** to display only shared images in the side menu. (Search can still be performed to assign shared images)

# 1.20.3

- **API** is being migrated to **game.modules.get("token-variants").api**
  - For now functions are still available through game.TokenVariants but will throw a deprecation warning
- **Search Paths** setting will now only be parsed during init and setting change instead of during image search.
  - Should resolve slow response times on ForgeVTT where recursive asset folder traversal can take a significant amount of time.

# 1.20.2

- Compatibility fixes for 0.7.10 and 9.238
- **Randomizer** and **Pop-up Settings** now allow disablement on a dynamic set of Actor types based on the game system being used instead of a hard coded list of 5e actors (Player, NPC, Vehicle)

# 1.19.1

- The module now supports all '**Token Configuration**' window settings when assigning custom config to images.

# 1.18.2

- Fixed **Art Select** window grid breaking when displaying images that skew heavily from 1:1 aspect ratio

# 1.18.1

- New setting under **Token HUD Settings** to update the character sheet portrait when selecting an image on the Token HUD.

# 1.17.1

- API
  - Deprecating **displayArtSelect(...)**. **showArtSelect(...)** is to be used instead
  - Exposed **doArtSearch** and **doRandomSearch** through **game.TokenVariants**
- Removed 'Filter by D&D 5e Monster (SRD)' setting
- Fixed a bug with Token HUD side menu being unresponsive when selecting an image with the same path as the current token image
- Custom image configs will now default to Prototype Token settings if the token being updated has a represented actor
- Added more options to disable automatic pop-ups with:
  - Disable on **Actor Create**, **Token Create** and **Token Copy+Paste**

# 1.16.1

- Added more settings to the randomizer
  - Disable for Tokens with **Represented Actor** or **Linked Actor Data**
  - Disable for PC/NPC/Vehicle
  - Show **Art Select** pop-up if disabled due to above ^
- Reorganised pop-up settings
  - Are now all grouped under a single setting
  - Pop-ups can now also be disabled based on Actor type (PC/NPC/Vehicle)

# 1.15.1

- Added randomization
  - Can be configured through the new setting: '**Randomizer Settings**'.
  - If enabled random images will be assigned based on the name and/or keywords of the Actor/Token.
- Added means to assign custom configuration for each image
  - Accessed by shift+left-clicking on any image in the **Art Select** or **Token HUD** side menu windows.
  - Once custom configuration is applied swapping between these images using the module will auto-apply the configuration to the token.
- Added a new setting to disable right-click pop-up on the character sheet portrait.

# 1.14.2

- Fixed compatibility issue with Search Paths setting from the previous version

# 1.14.1

- Removed '**Disable Caching**' setting, it has been replaced by a new window for the '**Search Paths**' setting which now allows caching enablement per each image source.

# 1.13.1

- Rolltables can now be added as image sources via 'searchPaths' setting by using the following format:
  - rolltable:{rolltable name} (e.g. rolltable:GoblinVariants)
- Because of rolltables the same image path may now be assigned multiple names. Each of these names will appear as seperate images that can be selected in the ArtSelect pop-up and the TokenHUD side menu.

# 1.12.2

- Copying tokens via Ctrl+C/Ctrl+V should no longer trigger the display of art select window.

# 1.12.1

- Fixed variant select not showing up on portrait right-click in the PF2E actor sheets.

# 1.12.0

- Exposed the caching function through **game.TokenVariants.cacheTokens()** to be used as part of macros for more convenient way of refreshing the cache.

# 1.11.0

- Added a new setting '**Always show HUD Button**'. When enabled the new button in the Token HUD will be shown even when no matching art has been found. This makes searches directly from the Token HUD to always be possible.

# 1.10.0

- Added a new setting '**Match name to folder**'. When enabled all searches will be done both on the file names as well as the file path:
  - e.g. 'Dragon' will match "token_art/**dragon**s/red/avatar.png"
  - Not that with this setting ON filters will also be applied to the paths.

# 1.9.0

- Added a search feature to the Token HUD art side menu. With the menu open right-clicking on the button again will open up a search box.
- ForgeVTT search paths will now only be recursively explored if the current users ID matches the user ID in the link. Prevents complications with ForgeVTT defaulting to the current user's asset folder when searching inaccessible links of other users.

# 1.8.3

- Fixed a bug causing an infinite loop when running Foundry on Forge and Forge search path is not found.
- Added debug logs protected behind **debug** setting

# 1.8.2

- Fixed a bug caused by clicking on the 'shared' icon in the Token HUD side image
- INCLUDE/EXCLUDE filters are now properly disabled when re-opening the **Search Filter Settings** and valid Regex present.

# 1.8.1

- Resolved issue with 'shared' icon not showing up on video tokens

# 1.8.0

- Implemented a workaround for Forge VTT Asset Folder search paths not being accessible to anyone beside the owner.
- Token art variants in the Token HUD side menu can now be individually shared by right-clicking on them; making the art accessible to players without having to enable the '**Enable Token HUD button for everyone**' setting.

# 1.7.0

- Added a new setting to disable the prompt displayed in-between Portrait and Token art pop-ups.
- Expanded on search filter settings:
  - Portrait and Token art searches can now be individually configured to include and exclude files with certain strings, or have them match a regular expression.

# 1.6.0

- Added a 'FVTT-TokenHUDWildcard' like button to the Token HUD
  - Uses token name as the search criteria
  - Can be enabled for all players
- Added support for video in the 'Art Select' window
- New setting to disable auto popups. Popups can still be triggered if 'Ctrl' key is held while dragging in the Token/Actor.

# 1.5.4

- Compatibility changes to make the module work with FVT Version 0.8.x

# 1.5.3

- Exposing **displayArtSelect** function used to render the **Art Select** popup through **game**.TokenVariants.displayArtSelect
  - async function displayArtSelect(name, callback, searchType)
    - **name**: The actor name to be used as the search criteria
    - **callback** function that will be called with the user selected art path as the argument
    - **searchType** ("token"|"portrait"|"both") string indicating whether the window is being displayed for a token search, portrait search, or both

# 1.5.2

- Added 'profile-image' class as a potential target to attach Right-click listener to which opens the Art Select window. Makes the module slightly more compatible with MonsterBlocks.

# v 1.5.1

- Added a right-click listener to the Actor Sheet portrait to bring up the module's Art Select screen.
- New Configurations:
  - Art Select screen can now also be brought up when dragging in actors from the Actor Directory if Ctrl or another key (set in **Art Directory Popup key** configuration) is held.
  - **Display Separate pop-ups for Portrait and Token art**: If enabled the user will be prompted with 2 windows every time a new actor or token is created. One for selecting the portrait and another for selecting the art for the token.
  - **Portrait art filter**: Pop-ups opened up for portrait selection will be filtered to only show files containing the text set here. e.g. if all of your portraits have an identifier such as '[Portrait]' or '.avatar.' it can be entered here to show only these files.
  - **Token art filter**: Same as the previous configuration, but is used when pop-up is displayed to select token art.

# v 1.4.3

- Removed a bug that caused multiple 'Art Select' screens to be displayed after switching between scenes

# v 1.4.2

- Removed system limitation to dnd5e

# v 1.4.1

- Added a search field to 'Art Select' screen to allow for custom name searches.

# v 1.3.2

- Fixing an issue with 'Art Select' screen being shown to players.

# v 1.3.1

- Fixing an issue with the default search path on a fresh world not being read correctly and throwing up "TypeError: path.startsWith is not a function"
- Fixing an issue with entire 'Data' folder being read when invalid path is provided.

# v 1.3.0

- Adding support for AWS S3 buckets.
  - Buckets configuered as per the following [PAGE](https://foundryvtt.com/article/aws-s3/) can be defined in the **Search Paths** configuration like so: **s3:{bucket-name}:{path}**

# v 1.2.0

- Introducing '**Search by Keyword**' and '**Excluded Keywords**' configs:
  - **Search by Keyword**: When enabled the art search will be done using both the Actor/Token full name as well as individual words within the name.
  - **Excluded Keywords**: Words within this list will be excluded from the keywords search.

# v 1.1.1

- Removed the restriction on Actor type having to be '**npc**' in order to trigger the display of **Art Select** screen.
- Actor art is no longer auto-replaced if only 1 variant is found and the proto actor has **DEFAULT** art. In these cases the **Art Select** screen will still be shown to allow the option to not assign any art.

# v 1.1.0

- Added a new button to 'Token Configuration' window's 'Image' tab which will bring up the 'Art Select' screen using the token's name as the search criteria.

# v 1.0.4

- Fixing space encoding causing issues with Actor to File name comparisons
- Fixing grid layout breaking in the art selection window when file names with spaces overflow to the 2nd line

# v 1.0.3

- Fixing grid layout breaking in the art selection window when filenames overflow the grid box

# v 1.0.2

- A fix to 'Filter by Monster (SRD)' config not being used correctly by the module

# v 1.0.1

- A fix to art reverting when creating tokens from already created actors

# v 1.0.0

- Initial release
