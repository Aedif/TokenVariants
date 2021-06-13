# 1.8.2

* Fixed a bug caused by clicking on the 'shared' icon in the Token HUD side image
* INCLUDE/EXCLUDE filters are now properly disabled when re-opening the **Search Filter Settings** and valid Regex present.

# 1.8.1

* Resolved issue with 'shared' icon not showing up on video tokens

# 1.8.0

* Implemented a workaround for Forge VTT Asset Folder search paths not being accessible to anyone beside the owner.
* Token art variants in the Token HUD side menu can now be individually shared by right-clicking on them; making the art accessible to players without having to enable the '**Enable Token HUD button for everyone**' setting.
# 1.7.0

* Added a new setting to disable the prompt displayed in-between Portrait and Token art pop-ups.
* Expanded on search filter settings:
    * Portrait and Token art searches can now be individually configured to include and exclude files with certain strings, or have them match a regular expression.
# 1.6.0

* Added a 'FVTT-TokenHUDWildcard' like button to the Token HUD
    * Uses token name as the search criteria
    * Can be enabled for all players
* Added support for video in the 'Art Select' window
* New setting to disable auto popups. Popups can still be triggered if 'Ctrl' key is held while dragging in the Token/Actor.
# 1.5.4

* Compatibility changes to make the module work with FVT Version 0.8.x

# 1.5.3

* Exposing **displayArtSelect** function used to render the **Art Select** popup through **game**.TokenVariants.displayArtSelect
    * async function displayArtSelect(name, callback, searchType)
        * **name**: The actor name to be used as the search criteria
        * **callback** function that will be called with the user selected art path as the argument
        * **searchType** ("token"|"portrait"|"both") string indicating whether the window is being displayed for a token search, portrait search, or both

# 1.5.2

* Added 'profile-image' class as a potential target to attach Right-click listener to which opens the Art Select window. Makes the module slightly more compatible with MonsterBlocks. 
# v 1.5.1

* Added a right-click listener to the Actor Sheet portrait to bring up the module's Art Select screen.
* New Configurations:
    * Art Select screen can now also be brought up when dragging in actors from the Actor Directory if Ctrl or another key (set in **Art Directory Popup key** configuration) is held.
    * **Display Separate pop-ups for Portrait and Token art**: If enabled the user will be prompted with 2 windows every time a new actor or token is created. One for selecting the portrait and another for selecting the art for the token.
    * **Portrait art filter**: Pop-ups opened up for portrait selection will be filtered to only show files containing the text set here. e.g. if all of your portraits have an identifier such as '[Portrait]' or '.avatar.' it can be entered here to show only these files.
    * **Token art filter**: Same as the previous configuration, but is used when pop-up is displayed to select token art.

# v 1.4.3

* Removed a bug that caused multiple 'Art Select' screens to be displayed after switching between scenes

# v 1.4.2
* Removed system limitation to dnd5e

# v 1.4.1

* Added a search field to 'Art Select' screen to allow for custom name searches.

# v 1.3.2

* Fixing an issue with 'Art Select' screen being shown to players.

# v 1.3.1

* Fixing an issue with the default search path on a fresh world not being read correctly and throwing up "TypeError: path.startsWith is not a function" 
* Fixing an issue with entire 'Data' folder being read when invalid path is provided.

# v 1.3.0

* Adding support for AWS S3 buckets.
    * Buckets configuered as per the following [PAGE](https://foundryvtt.com/article/aws-s3/) can be defined in the **Search Paths** configuration like so: **s3:{bucket-name}:{path}** 

# v 1.2.0

* Introducing '**Search by Keyword**' and '**Excluded Keywords**' configs:
    * **Search by Keyword**: When enabled the art search will be done using both the Actor/Token full name as well as individual words within the name.
    * **Excluded Keywords**: Words within this list will be excluded from the keywords search.

# v 1.1.1

* Removed the restriction on Actor type having to be '**npc**' in order to trigger the display of **Art Select** screen.
* Actor art is no longer auto-replaced if only 1 variant is found and the proto actor has **DEFAULT** art. In these cases the **Art Select** screen will still be shown to allow the option to not assign any art.

# v 1.1.0

* Added a new button to 'Token Configuration' window's 'Image' tab which will bring up the 'Art Select' screen using the token's name as the search criteria.

# v 1.0.4

* Fixing space encoding causing issues with Actor to File name comparisons
* Fixing grid layout breaking in the art selection window when file names with spaces overflow to the 2nd line

# v 1.0.3

* Fixing grid layout breaking in the art selection window when filenames overflow the grid box

# v 1.0.2

* A fix to 'Filter by Monster (SRD)' config not being used correctly by the module

# v 1.0.1

* A fix to art reverting when creating tokens from already created actors

# v 1.0.0

* Initial release