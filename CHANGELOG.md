# 4.7.0

> Note that some of these community filters will only be available if Token Magic FX is active.

- Controls added for the following overlay filters:
  - OutlineOverlay, Alpha, Blur, BlurPass, Noise, Adjustment, AdvancedBloom, Ascii, Bevel, Bloom, BulgePinch, CRT, Dot, DropShadow, Emboss, Glitch, Glow

# 4.6.0

Overlays

- New options: Animation
  - Rotate : enables overlay rotation animation
  - Duration (ms) : time in milliseconds for the overlay to complete a full 360 rotation
  - Clockwise : if enabled rotation will be clockwise, if disabled it will be anti-clockwise
- New options: Filter -> OutlineOverlayFilter
  - Draws an outline around the overlay
- New options: Filter Options
  - Will be shown if OutlineOverlayFilter is selected
  - Color: Outline color
  - Thickness: Outline thickness
  - Oscillate: when enabled outline thickness will increase and decrease overtime

# 4.5.2

- Fixed Token HUD button appearing to players only when the token has attached 'Shared' images
- When 'Randomize Wildcard Images' is enabled under the Prototype Token the module will now use Foundry's default getTokenImages() implementation
  - Will allow images to be retrieved for player even without 'Use File Browser' permissions

# 4.5.1

- Fixed errors thrown with Token HUD > 'Update Actor portrait' & 'Use a similarly named file' settings on

# 4.5.0

- Token/Tile HUD images will now only be searched when the button is clicked not when the HUD is opened
  - Removed 'Always show HUD button' setting
- New flag menu option: **Image Directory**
  - Allows a directory to be attached to an actor/tile. Images in that directory will be searched and included along others in the HUD
- New flag menu option: **Disable Name Search**
  - When set the Token HUD will not include images from Token name searches

# 4.4.3

- Fix for error thrown on item equip

# 4.4.2

- Small compatibility fix for Item Pile module

# 4.4.1

PF2e

- Fixed assigning of custom configs via Shift-Left clicking the status effects resulting in effect name being picked up as "null"
- Fixed errors thrown when 'Disable ALL Token Effect Icons' is on
- Fixed some warnings

# 4.4.0

Compendium Mapper

- New setting: **Missing Images**
  - Allows to define additional images to be considered as missing for the purpose of "Only include documents with missing images" setting
- **Compendium Folders** module's control entities will now automatically be skipped
- Warning message will now be displayed if Compendium Mapper is executed and no missing images have been found
- New keybinding added: Shift+M
  - Opens up Compendium Mapper without needing to go to module settings

Misc

- New header button has been added to Art Select window to open up FilePicker
- Fixing Custom Effect Mapping bugs related to saving configs
- Fixed console warning thrown by Overlays

# 4.3.0

New Settings

- Misc > Play Videos on mouse hover
  - When enabled videos will not auto-play in the Art Select and Token/Tile HUD, and instead will only un-pause when the mouse is hovered over them
- Misc > Pause Videos on mouse hover out
  - When enabled videos will pause when the mouse is no longer hovered over them

Compendium Mapper

- With the **Show current images in the 'Art Select' window** enabled the Art Select will now also contain Item descriptions
- Art Select window will now auto-focus on the search bar and place the cursor at the end of text

# 4.2.1

- Fixing issues with managing scale and mirroring on v10 when setting up custom image configurations

# 4.2.0

- Art Select button added to the Measured Template config form
- API change to allow multiple image selection on the Art Select window
  - Needed for integration with Mass Edit's randomization feature

# 4.1.1

- Added right-click listeners for Item Actions

# 4.1.0

- Added **Wildcard** randomization setting
  - Allows to merge wildcard images together with the module's other randomization options
- Fixed randomizer failing in some cases when randomizing multiple tokens at the same time

# 4.0.0

- v10 compatible version

# 3.6.1

- Fixing issues when using non-cached Search Paths
  - Image duplication
  - Paths not being scanned
- Some v10 compatibility fixes (the module DOES NOT yet fully support v10)

# 3.6.0

- Global Effect Mappings can now be copied onto and re-adjusted for specific Actors
- Custom Token Config window will now automatically select fields to be saved as they are changed/interacted with
- Fixed 'Active Effect' settings showing up in Compendium Mapper
- Fixed Effect Mapping windows not correctly toggling controls and removing configurations

# 3.5.2

- Non-image/video files will no longer be displayed in the Token HUD or Art Select window

# 3.5.1

- Fixing a conflict with Midi QOL when 'Transfer Token Updates to Prototype' is enabled
  - Namely Concentration not being removed upon HP drop to 0, though there were likely others as well

# 3.5.0

- Added a value _link_ for **Scale Width** and **Scale Height** sliders under Overlay Settings.
  - While enabled the two sliders will have their value synced
- Fixed all status effect being prevented from being drawn for Tokens with no represented Actor and when **Active Effects** > **Disable SOME Token Effect Icons** is enabled.
- Fixed file names with multiple dots in them not being properly evaluated during searches.

# 3.4.0

**Overlays**

!!! There have been changes to how overlay scaling works. If you have existing overlays consider twice before updating as some or all overlays may require scaling to be re-adjusted !!!

- Overlays are no longer affected by Token Magic FX
- Fixed issues with overlays breaking on particular "Token Dimensions (Grid Spaces)" changes
- Overlay cog icon can now be right-clicked to manually edit and copy options between overlays

New options:

- Link To Token Data: Rotation, Mirror Image, Opacity
- Underlay
  - Places the overlay bellow the token
- Play once and hide
  - If the overlay is a video it will be played only once and then hidden

Misc.

- Fixed particularly old "Search Paths" settings failing to convert to a newer format when updating the module

# 3.3.2

- Fixed 'Global Effect Configurations' not deleting when doing so through 'Configure Settings' window.

# 3.3.1

- Modified Token Configuration window used in custom configuration creation should now detect form-groups added by external modules post rendering of the window.

# 3.3.0

Overlays

- Changes in the overlay options can now be previewed on the tokens
- New option: **Rotation**
- 'overlays' flag is no longer used to display overlays on a token

Global Effect Configuration

- Configuration changes should now reflect immediately on tokens

Fixes:

- Fixed overlays not refreshing on 'actorLink' change
- Fixed effects not being read properly after toggling of 'actorLink'
- Fixed overlays not automatically refreshing on 'filter' changes
- Fixed global overlay configurations not getting applied on game load
- Fixed global configurations not reverting in some cases on effect end
- Fixed all PF2e items being recognized as conditions in some cases

# 3.2.0

Overlays/Active Effects

- New options added:
  - **Loop Video**, **Inherit Token Tint Color**, and **Tint Color**
- Overlays will now be unlinked from other overlays using the same video file
- Settings related to Active Effects have been moved out of **Misc** into a new **Active Effects** tab
- New settings:
  - **Disable ALL Token Effect Icons**
  - **Disable SOME Token Effect Icons**
    - **Effects with custom configurations**
    - **Additional Restricted Effect**

Misc

- New setting: **Misc** > **Transfer Token Updates to Prototype**
  - Token updates will also get applied to the associated actors proto token

# 3.1.0

Overlays

- Added a control to adjust how the overlay is displayed on top of the token:
  - Opacity, Offset, Scale, and Filter
- Fixed **Misc** > **Global Effect Configurations** setting sometimes displaying as empty when selecting _Apply_ with no changes being made
- Fixed effect mapping changes via Token HUD not immediately reflecting on an active token

# 3.0.0

Image Categories

- **Search Paths** can now be assigned categories that will group images under specific tags
- Each category can have a separate filter applied to it
- Additional categories can be created via **Misc** > **Custom Image Categories**
- Enabling of **Misc** > **Tile HUD** setting will no longer add a new checkbox in the **Search Paths** and will instead only toggle the display of the Tile HUD button
  - Tile paths can be defined as such using the **Tile** category
- **Search Filters** will now contain rows for each base (Token,Portrait,PortraitAndToken,Tile,Item,JournalEntry,Macro) and custom image categories
- **Art Select** now has an **Image Category** header button that allows you to switch which image category/filter is being searched with

Compendium Mapper

- Now also accepts Cards, Item, JournalEntry, Macro, and RollTable compendiums
  - At the moment will only update the main display image of each document
- New **Override Image Category** setting
  - Allows to change which category/filters are to be used during the mapping operation

Misc.

- During token create **Art Select** will now appropriately default to **Token** search
- Reduced the size of the static image cache file
- Fixed custom configuration not being removed when opening up a menu to individually change a configuration for an effect

# 2.15.1

Status Effect Configuration

- Active Effect renaming while applied to a token will be treated as removal of the original name of the effect and addition of the new name
- PF2e: Toggling of both conditions and effects should now be picked up by the module

# 2.15.0

- Right-click on the Token HUD button will now display additional controls bellow the search box
  - **Flags**: Opens a window to set overrides for Randomization and Pop-ups.
  - **FilePicker**: Opens Foundry's Directory Browser allowing you to select an image directory that will be displayed on the Token HUD
    - These images can be **Shared** and interacted with as usual

# 2.14.1

- Fixed effects on unlinked tokens being inappropriately read as enabled

# 2.14.0

- Equipping items with effects should now properly apply custom configurations setup via the module
- Fixed scripts attached to effects not running in some cases when multiple tokens were updated at the same time
- Fixed token image flickering when updating custom configurations that are already applied to tokens

# 2.13.0

Static Cache

- New setting: Misc > **Cache File**
  - Allows you to specify the path and name of the image cache file
  - Can be placed outside of the **token-variants** module folder meaning it wont be overwritten upon module update
- If cache file is not found during world load the module will no longer fail the caching operation and instead re-cache and create a new file
- **Cache Images** button will now use the static settings as they are currently entered, not how they are saved

# 2.12.1

- Fixing key bindings becoming unresponsive after Right-clicking images in the Token HUD

# 2.12.0

- New setting: Misc > **Global Effect Configurations**
  - Provides a means to define custom effect image mappings and configuration for an effect that get applied to ALL tokens.
  - Token specific mappings will override the global ones
- Token Configuration fields that apply flags from modules such as **Perfect Vision**'s **Monochrome Vision Color** should now properly save and revert when managing them through the custom effect configurations.

# 2.11.0

Misc

- Resolving issues with search path sources not being processed properly

Status Effect Configuration

- Effect mapping changes should no longer require effect re-toggle
- General fixes to improve how the module handles effect manipulation with linked and unlinked tokens
- New option: **Overlay**
  - When checked the selected image will be overlaid on top of the token image

# 2.10.1

- Fixed '**Active Effect Config List**' not opening if a mapping existed on a token prior to **2.10.0**

# 2.10.0

Status Effect Configuration

- Configurations can now be manually edited via a new control
  - Allows for flags to be entered along with the other token data fields
- Scripts can be attached to Status Effects
  - Two scripts; one applied when the effect is added/enabled and the other when it is removed/disabled

Misc.

- Fixing a bug with S3 path scanning
- Added a new setting: **Token HUD** > **Show full path on hover**
  - When enabled will show the full file path when hovering over images

# 2.9.1

- Fixed '**Art Select**' closing before the user can select the Token image when the bellow two settings are enabled and a search is performed before selecting the portrait.
  - **Display separate pop-ups for Portrait and Token art**
  - **Disable prompt between Portrait and token art select**

# 2.9.0

API

- Updated API documentation
- showArtSelect, doImageSearch, doRandomSearch
  - Now all support a **Search Algorithm** and **Search Filters** setting override via **searchOptions**
- doRandomSearch
  - Randomizer settings override using **randomizerOptions**
- updateTokenImage
  - Now supports 'no image' updates and token **config**
  - If token **config** is passed to the function it will be applied and override any other configuration applied by the module
    e.g. `game.modules.get('token-variants').api.updateTokenImage("", {token: canvas.tokens.controlled[0], config: {tint: "#dc1818"}});`
  - Next **updateTokenImage** call without a **config** passed to it and no config attached to the image itself will revert the change e.g. `game.modules.get('token-variants').api.updateTokenImage("", {token: canvas.tokens.controlled[0]});`

# 2.8.1

- Fixed '**Art Select**' not showing for **foreground** tiles when using '**Show Art Select: #**' key bindings

# 2.8.0

Tile HUD

- Added '**Art Select**' button to the Tile configuration window
- Use of any of the '**Show Art Select: #**' key bindings with tiles selected will result in '**Art Select**' being shown for the tiles

# 2.7.1

- Fixing pop-ups not showing up properly since the last update when no flags have been set on the token

# 2.7.0

- Tokens can now be flagged to override pop-ups and randomization settings
  - Menu accessed by **Shift+Left-clicking** the '**Token HUD button**'
  - Useful if you want to disable/enable randomization just for a couple of tokens
  - Like pop-ups but would rather not see them for specific actors
- Flags:
  - `actor.setFlag('token-variants', 'randomize', true);`
  - `actor.setFlag('token-variants', 'popups', true);`

# 2.6.1

- Fixing parsing of old format s3 paths

# 2.6.0

Search Paths

- **Search Paths** setting should now be configurable for any source
- Source is now to be entered into a separate input box
  - Currently set paths will be automatically converted to use the new format
- Clicking on the folder icon will now open up a FilePicker or a dialog depending on the source type, allowing you to select the folder/rolltable you want to be scanned
- Optimizations for '**forge-bazaar**' source paths
- The new default for ForgeVTT worlds will be to read '**Caeora's Maps, Tokens, and Assets**' from the bazaar

Misc.

- Unrestricted '**Config**' and '**Override**' keybindings as regular players depending on permissions may require these

# 2.5.0

- **Enable Status Config** setting replaced by the new **Status Config** permission
  - Allows any role to access status mappings
  - Configuration can only be changed if the user owns the token/actor
  - New images can only be selected if the user has **User File Browser** or **Token Configuration Art Select** permissions
- Renamed **Token Image Path button** permission to **Token Configuration Art Select**
- **Forge Asset Library Paths** setting should no longer show up when the game is not running on ForgeVTT

# 2.4.0

Compendium Mapper

- Now supports mapper specific '**Search Filters**' and '**Search Algorithm**' settings
- This should allow to run the mapper completely independent of the normal module settings

Status Config

- Status Effects (inc. Visiblity and Combat states) can now have Token configurations assigned independent of any image
- New setting: **Stack Configurations**
  - Controls the behaviour of multiple configurations being applied on the same token
  - When enabled configurations will stack instead of overriding each, with higher priority configurations having precedence
- Fixed a bug causing removed effects not being picked up by the module in certain cases

Misc

- Tile image cache will now also be stored when **Static Cache** setting is enabled

# 2.3.0

New setting: **Misc** > **Tile HUD**

- With the new setting enabled **Search Paths** will include an option to specify a path as a Tile image source
- Adds a new button to the Tile HUD including some of the features of the Token HUD button
  - Right-click to perform tile image searches
  - Right-click images to pin them to the tile
  - Shift+Left-click the button to assign a name to the tile which will be used in the search

# 2.2.0

New keybindings available only on Foundry V9:

- Show Art Select: Portrait
- Show Art Select: Token
- Show Art Select: Portrait+Token
  - Allows to quickly bring up the **Art Select** window for one or more tokens already placed on the canvas and change their Portrait and Token images.

# 2.1.1

- Videos in the '**Art Select**' window and the **Token HUD** menu are now **MUTED**

# 2.1.0

New setting: **Misc** > **Static Cache**

- Can be used to speed up image caching
- When enabled the image cache will be stored in a file and read on game load
- The cache will only be refreshed when '**Search Paths**' or '**Forge Asset Library Paths**' settings change, or by manually re-caching by clicking the '**Cache Images**' button
- Re-caching can also be performed by running the following in a macro:
  - **game.modules.get("token-variants").api.cacheImages()**

_Note: If running on ForgeVTT or some other hosting service it may take 5 minutes or more for cache file updates to be reflected in your browser_

# 2.0.0

**!!!** **forgevtt:path/to/art** type paths will no longer work **!!!**

- '**Search Paths**' setting will no longer support ForgeVTT asset library paths
- '**Forge Asset Library Paths**' setting is to be used instead
- The old method of reading from Forge's Asset Libraries utilized a hack which was extremely slow and was causing confusion to the user's. '**Forge Asset Library Paths**' which has been implemented for a while now is **significantly** faster and has been the preferred method, which as of this version is now mandatory.

Settings

- Majority of module's setting can now be found and configured under one window: '**Configure Settings**'
- **Token HUD** > **Include wildcard images** is now a world setting

Misc.

- Fixed **Art Select**'s fuzzy algorithm slider breaking when set to 100%
- Unknown type files should no longer break the formatting in the **Art Select** and **Token HUD** side menu

Custom Token Configuration

- Can now be controlled per field rather than tab

# 1.36.2

- Fixed an issue with **Forge Asset Library Paths** setting not properly reading and storing paths

# 1.36.1

- Fixed Token Magic FX conflict where filters would not be applied on scene load
- **Token HUD Settings** > **Update Actor Portrait**, is now a world setting
- Added a new setting **Token HUD Settings** > **Update Actor Portrait** > **Use a similarly named file**
  - Instead of using the same image applied to the token the module will perform a 'Portrait' search and apply an image with a name closest to the one used for the token
  - Relies on **Search Filter Settings** being configured appropriately so that the module can distinguish between Token and Portrait images

# 1.35.2

- When a specific image is mapped to a user that image will no longer be highlighted in the Token HUD for non-gm players
- Fixed the "ghost" of the token image during drag not reflecting the user mapping
  - The fix relies on '**libWrapper**' being enabled, all other module features are not affected by this dependency

# 1.35.1

- New feature: Show a different token image to each user
  -- Overrides custom Status Effect image mappings (irrespective of their priority)

# 1.34.3

- Token HUD setting '**Include wildcard images**' will no longer require '**Randomize Wildcard Images**' to be enabled in the Proto Token configuration in order for the module to display all the found wildcard art.
- Fixed Token Hud Wildcard '**Disable button**' setting not saving

# 1.34.2

- Fixed Token HUD button being shown with '**Include wildcard images**' enabled even when no wildcard images have been found

# 1.34.1

- Removed '**Disable right-click pop-up on the character sheet portrait**' setting
- Removed '**Enable Token HUD button for everyone**' setting
- Removed '**GM Only**' setting
- Added a new '**Permissions**' setting
  - Allows to control access to module features based on user role

# 1.33.3

- Fixed '**Disable Cache Notifications**' setting not working since release 1.33.1
- Import function no longer expects all settings to be present in the exported setting's file

# 1.33.2

- Fixed module breaking on Foundry v9.x due to attempting to read an unregistered v8.x specific setting

# 1.33.1

New setting added: '**Import/Export**'

- Brings up a dialog allowing the user to export and import module settings to/from a JSON file

# 1.32.5

- Fixed some Token HUD world settings not updating when running on updated versions of the module
- Fixed sharing of images via the Token HUD sometimes resulting in images being shown from an image search even when the user does not have appropriate permissions
- Fixed Status Effect mapping menu being accessible without proper permissions

# 1.32.4

- Fixed tokens with linked actors ignoring status effect mapping's priority
- PF2e specific: Fixed tokens with linked actors not updating to the status effect mapping

# 1.32.3

- Fix to prevent the module from performing the same update on multiple user clients

# 1.32.2

- **Assign Status Effect** Config window height will now adjust to the size of the list

# 1.32.1

New Config window added to '**Assign Status Effect**'

- Accessed via Shift+Left-Click
- Displays all Status Effect image mappings setup for the Actor
- Allows to assign images to any effect including those not found in the Token HUD menu
- **Note**: You might notice **token-variants-combat** and **token-variants-visibility** which are effect names used by the module to track Combat and Visibility mappings

# 1.31.1

New Pop-up setting: **GM Only**

- Restricts pop-ups to GM users only, even if '**Use File browser**' and '**Configure Token Settings**' permissions are granted.

Misc.

- Fixed '**On Token Create**' and '**On Token Copy+Paste**' pop-up settings conflicting with each other in certain cases.

# 1.30.1

**Fuzzy Search**

- New search algorithm allowing approximate image searches
- Can switch between the old '**Exact**' and new '**Fuzzy**' search via the '**Search Algorithm Settings**' :
  - **Percentage match**: Percentage controlling how accurately file/folder name must match
  - **Add the percent slider to the Art Select window**: slider is added to the pop-ups allowing to change the match accuracy on the fly
  - **Limit**: Maximum number of results to be returned per search

**Compendium Mapper**

- Added private instance of **Search Algorithm Settings** used just for the mapper. Changes here will not affect the settings used for the rest of the module.

**Art Select**

- Removed the '**Search**' button; searches are now performed and returned as you type
- If fuzzy search is enabled the percentage match and parts of the file name and path that were relevant to the match will be highlighted or shown in the tooltip on hover
- Fixed the window in some cases not retaining it's height/width after being closed
- The window will now remember and re-open in it's last position
- Scroll bars should no longer show on the images themselves in Foundry v9 and will be limited to horizontal on the image name
- Fixed GIFs not rendering in the Art Select window and Token HUD

**API**

- **game.TokenVariants**: Has been removed
- **game.modules.get('token-variants').api**: Should be used instead

**Misc.**

- Fixed Token HUD side menu breaking when image/video src is not found
- Fixed Token HUD World Settings title displaying when user has no GM permissions

# 1.29.2

- Ending combat should now properly remove the custom combat images assigned to all the combatants
- Fixed Status Effect images not being applied to linked tokens
- Fixed tokens not reverting to default/original image if multiple active tokens exist that are derived from the same actor. Default/original images are now remembered per token rather than actor.
- Fixed Token HUD closing when toggling mapped status effects.
- Token HUD images will now display their file names when hovered over.
- Most Token/Actor updates will now be performed in batches. Should see less console errors and some performance improvements when copying large amounts of tokens or using the compendium mapper.

# 1.29.1

- New '**Compendium Mapper**' settings:
  - '**Ignore Token**' and '**Ignore Portrait**' found under '**Apply different images for Portrait and Token**'
  - When enabled automation and 'Art Select' windows will ignore either token or portrait respectively affecting only the art of the other.

# 1.28.3

- Resolved an issue with files with spaces in their name not being found when 'Match name to folder' is enabled.
- Token's are now updated once per canvas.app tick. Should prevent errors caused by rapid updating of the same token.

# 1.28.2

- Fixed token image not updating on 'Actor create' with **Display separate pop-ups for Portrait and Token art** disabled
- Fixed Token HUD button breaking when right-clicking the very edge of the image in the side menu

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
