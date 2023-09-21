# 4.56.4

- Fixed the `Overlay Config` throwing errors when attempting to open

# 4.56.3

- Fixed `Art Select` searches causing queues to open

# 4.56.2

- Module is now bundled into a single `token-variants.js` file

# 4.56.1

Overlays

- Returned `Display Priority` > `BOTTOM` option when `UI Element` is selected

# 4.56.0

Overlays

- Fixed overlays not being rendered in chosen display order
- New option: `Misc` > `UI Element`
  - Overlay marked as a UI Element will always displays above Tokens and will not interact with scene lighting

Mappings

- `Image` will no longer be displayed as broken if it hasn't been added
- `Health Circles` template positioning fixed
- Templates `Info Box #1`, `Info Box #2`, `Info Box #3`, `Health Bar`, `Health Ring`, `Health Hearts`, `Health Circles`, `Health Squares` and `Spell Slot Ring` have been set as UI elements

API

- `toggleTemplate(token, templateName)`
  - Applies and removes templates from the provided token
- `toggleTemplateOnSelected(templateName)`
  - Calls `toggleTemplate(...)` for all currently selected tokens
- `toggleTemplateDialog()`
  - Opens template dialog allowing you to apply templates to currently selected tokens
  - New keybinding has been added to allow calling of this function via key-presses (`Toggle Template Dialog`)
- `setOverlayVisibility({userName = null, userId = null, label = null, group = null, token = null, visible = true} = {})`
  - Sets overlay `Visibility` > `Limit Visibility to users` for the given tokens
  - User: `userName` or `userId`
  - Overlay: `label` or `group`
  - Token: `token`
  - Check/Un-Check: `visible`

# 4.55.1

Overlays

- Button added to use the same image as the token

API

- Fixed errors thrown when calling unassignUserSpecificImage(...)

# 4.55.0

Overlays

- Fixed a bug causing incorrect positioning of child overlays when they're out of bounds of the parent overlay
- Fixed shape overlays not inheriting tint and opacity when they are linked to the token
- Assisted Positioning utility has been added under ` Image`` >  `Positioning`

  - Allows to position overlays via the use of your mouse (Click and/or Click and Drag to move the overlay)
  - 4 positioning `modes` are provided via a dialog: `Token`, `Tooltip`, `HUD`, `Static`
  - `Step Size` will make the overlay move in specific size steps/increments
  - `Anchor` behaves just as it does on the main overlay form

Mappings

- Fixed `Disposition Markers` template
- Templates are now sorted into groups
- `Spell Slot Ring` template will now only be available if running `DnD5e`

Misc.

- New Setting `Effects` > `Token Element` > `Hide Elevation`
- New Setting `Effects` > `Token Element` > `Hide Border`
  - Hides token elevation and border

# 4.54.0

- Fixed cache operation failing if an image is found containing `%` character

Overlays

- New option `Visibility` > `Limit Visibility to State` > `HUD`
  - When enabled overlay will be shown only when the Token HUD is displayed
- New option `Image` > `Positioning` > `Offset X (Pixels)`
- New option `Image` > `Positioning` > `Offset Y (Pixels)`
  - Allows offset to be specified irrelevant of the parent dimensions
  - One usecase would be be to position an overlay a set amount of distance away from the token edge, in which case you'd set parent relative width to 0.5 (half the width of the token) and then use pixel offset to move it an additional 50 pixels. (is equivalent of setting pixel offset to an expression: token.w / 2 + 50)

# 4.53.2

- Fixed errors thrown upon Mapping form closing when JavaScript expression field is expanded
- Fixed errors thrown when migration of globalMappings is necessary on game load

# 4.53.1

Mappings

- Fixed PF2e Effects not being recognized in expressions
- New setting: `Effects` > `Update tokens on current scene only`
  - Prevents linked tokens from being updates across the entire world when a mapping change occurs.
  - Useful if token updates are slow on your server, but means that there might be some slight de-syncs happening if multiple scenes are active at the same time across multiple clients.

# 4.53.0

Mappings

- `Expression` field now contains a toggle that presents a textarea for JS code to be input instead of or along side of an `Expression`
  - The module will evaluate both the expression and the JS code to determine if they are 'true' and apply or remove the mapping
  - Note that the module still only responds to token, actor, and item updates, so the JS code will not be run until they are affected.

Misc.

- Fixed overlays rendering bellow the token when elevation is assigned

# 4.52.1

- Fixed a bug causing `Randomize Wildcard Images` to be preselected

# 4.52.0

- `Image Names Contain Dimensions` renamed to `Image Updates` > `Dimensions in Image Names` > `Token HUD Wildcard`
- New option `Image Updates` > `Dimensions in Image Names` > `Forgotten Adventures`

  - When enabled image names will be examined for a string matching `_Scale###_` and apply appropriate scale to the token

- Fixed an issue with child overlays not being removed when their parent's expression is false
- Fixed Global Mapping form not saving changes when opened through the `Configure Settings` form

# 4.51.0

Mappings

- New option: `Scripts` > `Macro`
  - If provided will find and execute macros by the given names

Overlays

- Fixed `Text` > `Align` select box not pre-selecting the saved value

# 4.50.0

Prototype Token

- New option: `Disable HUD Button`
  - Prevents TVA button from being shown on the Token HUD
  - The button can also be disabled by running the following:
    - `_token.document.setFlag('token-variants', 'disableHUDButton', true)`
- Fixed toggling of the `Randomize Wildcard Images` checkbox not updating form size when new TVA field is revealed or removed

Overlays

- New tab: `Triggers`
  - Allows hover and mouse Click triggers to be assigned to overlays (hoverIn, hoverOut, clickLeft, clickLeft2, clickRight, clickRight2)
  - Upon the trigger being met the module will; ` run a macro``,  `run a script`` , `toggle TMFX preset ``, and/or `toggle DFreds Convenient Effect`
  - Both `token` and `actor` will be available within the context of the macro or script
  - TMFX and DFreds toggles will apply to the Token/Actor the overlay is assigned to
- New option: `Visibility` > `Limit Visibility to Owner`
  - Limits visibility to users that own the token the overlay belongs to

Mappings

- New template: `Spell Slot Ring`
  - Displays a ring overlay that indicates the remaining number of spell slots
- Fixed a bug that under specific circumstances would prevent `Global Mappings` form from opening

# 4.49.2

- The following settings will now also affect the combat tracker:
  - `Disable ALL Effect Icons`
  - `Disable SOME Effect Icons`

# 4.49.1

- Fixed setting: `Disable SOME Token Effect Icons` > `Effects with mappings`

API

All examples assume the following has been run first: `const api = game.modules.get('token-variants').api;`

- New function: `assignUserSpecificImage`
  - For the given token assign an image to be displayed for only the provided user (userName or userId)
  - e.g. `api.assignUserSpecificImage(token, 'path/to/img.png', { userName: 'Azrael' });`
  - If an image is not provided `unassignUserSpecificImage` will be called instead
  - e.g. `api.assignUserSpecificImage(token, null, { userId: 'wqcg1nfJlbw2rYjn' });`
- New function: `assignUserSpecificImageToSelected`
  - Assign an image for the given user and all currently selected tokens
  - e.g. `api.assignUserSpecificImageToSelected('path/to/img.png', { userName: 'Azrael' });`
- New function: `unassignUserSpecificImage`
  - For the given token un-assign any images assigned via `assignUserSpecificImage`
  - e.g. `api.unassignUserSpecificImage(token, { userName: 'Azrael' });`
  - If a name or id are not provided all images will be unassigned for all users
  - e.g. `api.unassignUserSpecificImage(token);`
- New function: `unassignUserSpecificImageFromSelected`
  - Un-assign images set via `assignUserSpecificImage` for all currently selected tokens
  - e.g. `api.unassignUserSpecificImageFromSelected({ userName: 'Azrael' });`

`userName` and `userId` can also be provided as arrays

- e.g. `api.assignUserSpecificImage(token, 'path/to/img.png', { userName: ['Azrael', 'Azulon'] });`
- .e.g `api.unassignUserSpecificImage(token, 'path/to/img.png', { userId: ['wqcg1nfJlbw2rYjn', 'cDfy3cFieNjb5vsL'] });`

# 4.49.0

Mappings

- `Weapons` and `Equipment` type item names can now be entered into the expression field to trigger when they are equipped and un-equipped
- New control added to delete all mappings under the same group

Overlays

- New option: `Text` > `Word Wrap Width`
- New option: `Text` > `Break Words`
- New option: `Text` > `Max Height`
- Complex expression support added to `Text` > `Text` field
- Fixed color interpolation on v10

# 4.48.0

Overlays

- New option: `Text` > `Curve` > `Angle`
  - Curve text by defining an angle of a circle you want it to curve by

# 4.47.0

Overlays

- Shapes will no longer be rendered as textures thus avoiding texture size limits when attempting to display extremely large shapes
- Renamed `Appearance` tab to `Image`
- New options: `Image` > `Width` and `Image` > `Height`
  - Allows to circumvent various automatic scaling options and directly specify overlay dimensions
- Every slider has been adjusted to display bigger text box inputs and support expressions
- A set of "core" variables can now be accessed inside expression
  - Refer to header button: `Core Variables`

# 4.46.1

- Fixed errors thrown when DFreds Convenient Effect is left empty in the mapping script

# 4.46.0

Effect Mappings

- `Effect` has been renamed to `Expression`
- New field: `Label`
  - The module will no longer use the `Effect` field to merge global and actor specific mappings and will instead use the `Label`
  - The same `Label` can be re-used multiple times within the same form
- New setting: `Active Effects` > `Merge Global and Actor mappings based on Groups`
  - Instead of comparing `Labels` Actor mappings will take precedent over Global ones if they belong to the same group
- Users can now create their own Templates
- Scripts now support `DFreds Convenient Effects` allowing you to apply and remove CEs
- New templates
  - Health Bar/Ring/Hearts/Squares

Overlays

- All text fields in `Overlay Config` form now support expressions
  - e.g. `{{texture.tint}}`, `{{width}} * 100`
- `Appearance > Tint`, `Text > Fill`, & `Shapes > Fill` can now be interpolated between 2 colors
- Overlay's parent now works off of an internal ID system allowing parent's `Label` and `Expression` to be changed without the parent-child link being broken
- New setting: `Limit Visibility to State` -> `Highlight`
  - Hover and Highlight are now treated as separate states
- New setting: `Variables`
  - Allows creation of variables that can be re-used within the overlay form
- New setting: `Text` > `Align`
- Shapes
  - New shape: Torus
  - New controls added: Label, Clone, Move Up/Down
- Overlays set to display on hover will not if the ruler is active
- Image/Overlay Shapes/Text
  - Now support `Repeating`, allowing the same shape, text or image to be rendered multiple in a sequence
  - e.g. a FontAwesome heart shape can be setup to be rendered once per 10hp increment creating a heart based health bar

Macro Configuration form

- `Art Select` will now be opened upon Right-Click of the icon

Bug Fixes:

- Fixed Token HUD art menu closing when an image has been `Shared`/`Right-Clicked`
- Fixed `FontAwesome` glyphs not rendering on FireFox
- Fixed overlay preview breaking when adding/removing shapes

# 4.45.2

- Fixed `Compendium Mapper`'s search settings not saving

# 4.45.1

- Fixed tokens not reverting to default image

# 4.45.0

- Token Configurations can now be attached to `Search Paths`
- Fixed tokens not being identified as in-combat when GM is on another scene
- Overlay color fields now support expressions in the form of `{{path.to.property}}` allowing colors to be sourced from token/actor properties
  - e.g. `{{actor.folder.color}}`
- `Effect Mapping` group toggles will now be remembered even if the world is re-loaded
- v11 Warning fixes
- `usingCustomConfig` flag will now only be applied when needed
- `Compendium Mapper`
  - Now displays a dialog showing mapping progress when `Auto-apply` is selected
  - Now allows `Search Paths` to be defined specifically for it
    - Note that if `Compendium Mapper`s search paths differ from your main paths then caching will be performed before and after mapping finishes

# 4.44.0

- Negative values are now accepted in comparators
  - e.g. `disposition=-1`
- HP Decrease (`hp--`), and HP Increase (`hp++`) effects can now be used as properties in comparator expressions
  - `hp++>4`, `hp++>=50%`, `hp--<-4`, `hp--<=-50%`
- Fixed `Effect Names` containing composite expressions with multiple quotes resulting in an incorrect caret position

# 4.43.0

- New setting: `Token HUD` > `Token Animation`
  - Controls whether core Foundry's animation should be applied on image change via Token HUD
- `name` flags will now only be added to tokens if the image name differs from the file name
- New setting: `Active Effects` > `Internal Effects` > `HP Change`
  - When enabled flags will be stored on tokens/actors to allow the use of `hp--` and `hp++` expressions in effects mappings
    - `hp--` - hp has decreased
    - `hp++` - hp has increased
  - Duration can be optionally provided to remove the flag after some number of seconds

# 4.42.2

- Various `Effect Mapping` fixes for PF2e system
- New template: `Disposition Markers`
  - Displays circles underneath tokens coloured based on their disposition.

# 4.42.1

- The module will now batch Active Effect/Item changes to prevent rapid updates of the token

v11

- Fixed curved text overlays and shapes not rendering
- Fixed warning thrown when visibility on hover is enabled for overlays

# 4.42.0

- Effect names now support wildcards

  - `\*` and `\{` `\}`
  - e.g.
    - `Exhaustion\*`
    - `Exhaustion \{1,2,3\}`
    - `Level \{1,2,3,4,5\} Bolt`

- Added `Art Select` button to Active Effect configuration form
- Fixed white spaces in effect mapping names being parsed as `&nbsp;` (160) instead of regular whitespace (32)

# 4.41.2

- `Misc` > `Image Names Contain Dimensions`
  - These dimensions will now be treated as custom configs, meaning switching images will revert these dimensions

# 4.41.1

- `Misc` > `Image Names Contain Dimensions`
  - Fixed it's interaction with default wildcard image
- `Effect Mapping` Boolean comparators (e.g. flags.module.val="true") will now evaluate non-existent flags and flags pointing to objects as truthy/falsy
- Adjusted Info Box templates to display over tokens

# 4.41.0

**Effect Mappings**

- New header button: `Templates`
  - Brings up a menu that allows you to quickly apply pre-configured mappings
  - Explanations/images of these mappings can be found here: https://github.com/Aedif/TokenVariants/wiki/Templates
- Improved Boolean comparisons in `Effect Name` expressions
  - e.g. `flags.token-variants.heart="true"` will now be evaluated as `Boolean(flags.token-variants.heart)`
  - This means you can now properly check existence/non-existence of a flag
- Added new comparator: `<>` (lesser or greater than)

**Overlays**

- New setting: `Overlay` > `Shapes`
  - Draw a custom shape instead of using an image or text
  - Currently supports rectangles, ellipses, and polygons
- New setting: `Overlay` > `Link to Stage` > `Scale`
  - Scales the overlay according the the canvas zoom/scale
- FontAwesome Glyphs can now be used in text overlays
- New lines ('\n') are now supported in text overlays

**Misc**

- New setting: `Misc` > `Image Names Contain Dimensions`

  - When enabled the module will recognise the following strings in image names and apply corresponding scale, width, and/or height to the token:
  - `_scaleX.X_` (e.g. `Goblin_scale0.8_.png`)
  - `_widthX.X_` (e.g. `Goblin_width0.5_.png`)
  - `_heightX.X_` (e.g. `Goblin_width2_height_2.png`)

- Fixed error thrown when saving `Compendium Mapper`'s `Search Settings`

# 4.40.0

- v11 warning fixes
- New setting: `Active Effects` > `System's HP Path`
  - Allows to change the module's assumed path to the HP values (`attributes.hp`)
  - This path is used by HP comparators in effect mappings (e.g. `hp<=50%`)

# 4.39.0

- Fixed `Display Token Effect Icons on Hover` setting not updating effect visibility immediately on setting change
- New Overlay setting: `Visibility` > `Limit Visibility to Token With Effect`
  - Overlay will only be shown to tokens that have an active effect matching this name
- New Overlay setting: `Visibility` > `Limit Visibility to Token With Property`
  - Overlay will only be shown to tokens that pass the provided expression e.g.
  - `actor.system.attributes.senses.truesight>0`
  - `hp<=50%`

# 4.38.2

Overlays

- Should now be properly refreshed on effect mapping change
- v11 compatibility fixes

# 4.38.1

- Fixed `Display Token Effect Icons on Hover` not hiding effects on game load
- `Disable ALL Token Effect Icons` and `Disable SOME Token Effect Icons` setting changes no longer require game reload

# 4.38.0

- New overlay option: `Link` > `Dimensions`
  - Scales the overlay based on Token Dimensions instead of scale
- Fixed `User to Image` mappings not turning Tokens/Tiles invisible in certain situations
- Added `Art Select` buttons to Drawing, Note, and Scene configuration forms
- Added `Art Select` button to `User To Image` form
- RollTable result icons can now be Right-clicked to open `Art Select`
- Effect group toggles will be remembered after closing the form
- Added `lib-wrapper` as a dependency
- Implemented a workaround for ForgeVTT Bazaar paths not being recursively searched when set to `modules`, `assets`, `worlds`, or `systems`

Hooks & Wrapper

- The module will now dynamically register/un-register hooks and wrappers according to settings
- You can view all the module hooks and wrapper organized by feature via:
  - `game.modules.get("token-variants").api.hooks`
  - `game.modules.get("token-variants").api.wrappers`
- While still in test, module features can be forcibly turned off regardless of any other setting via `featureControl`:
  - `game.settings.get("token-variants", "featureControl")`
  - May require game re-load or scene refresh/change for some features to fully turn on/off

# 4.37.0

- Added a disable button for Effect Mapping groups
- Copy global effect mappings dialog and Overlay parent field is now sorted into mapping groups
- Effect Mappings will now be sorted based on priority first and then the effect name

# 4.36.0

Overlays

- New option: `Misc` > `Parent`
  - Allows assignment of an overlay as a child to another instead of the token
  - This `child` overlay will move and scale relative to the `parent`
  - Note that if the parent mapping is not applicable then children will not get displayed
- New option: `Appearance` > `Anchor`
  - Allows you to define the point on the overlay that will be used for positioning
  - e.g. top-left corner, centre, bottom-right corner, etc.
- Fixed position offset inaccuracies when scale != 1

Effect Mapping

- New option: `Group`
  - Allows to visually group mappings within the form
- New option: `Disable`
  - Disables the mapping without needing to remove it

# 4.35.1

- Fixed player clients attempting to perform GM only updates
- Improved cross-scene updating of Tokens via `Effect Mappings`

# 4.35.0

Overlays

- New option: `Visibility` > `Limit Visibility to State`: `Hover`
- New option: `Visibility` > `Limit Visibility to State`: `Control`
  - Will restrict visibility of overlays to when the Token is hovered over or controlled

# 4.34.3

- Fixing multiple property insert into text overlays

# 4.34.2

- Token Custom Config bug fix

# 4.34.1

- Text overlays will now respond to token/actor updates

# 4.34.0

Overlays

- Overlays/underlays will no longer display above or bellow other tokens unless specified to:
- New option: BOTTOM
  - Underlays with this enabled will ALWAYS show bellow all tokens
- New option: TOP
  - Overlays with enabled will ALWAYS show above all tokens

# 4.33.2

- Patch fix for Foundry's faulty `SpriteMesh.calculateTrimmedVertices()` method

# 4.33.1

- HP comparator support for Simple World-Building system

# 4.33.0

- Added new special effect names:
  - `combat-turn`
    - Activates for the token whose turn it is in combat
  - `combat-turn-next`
    - Activates for the token who is next in turn order

# 4.32.0

!! Important !!

- Fixed inaccuracies wit Overlay scaling and offsetting

  - This fix may change the size and positioning of your current overlays. **DO NOT** update or revert back to the previous version until you are ready to adjust your mappings

- Fixed current Token image showing in manual Token HUD searches
- Fixed shared Token images not being marked as such in manual Token HUD searches
- Fixed Token Config not being removed from effect mappings
- Fixed conflict between `Disable SOME Token Effect Icons` setting and `DFred's Convenient Effects` module
- Removed `Limit Visibility to Users` overlay toggle
  - This setting will now be automatically enabled if any of the users are selected
  - User selection is now also done via a checkboxes rather than a multi-select box

New Overlay options

- Link To Token: Scale
  - When enabled overlays will scale together with the token
- Link To Token: Rotation - Overlay Relative
  - When enabled the overlay will rotate together with the token but around it's own centre point
- Text
  - Text to be displayed instead of an image/video
  - Can accept variables via the following format: {{name}}
  - Can be customized using:
    - Font Family
    - Font Size
    - Fill Color
    - Curve: Radius
    - Curve: Invert
- Shift-left clicking status effects in the "Assign Status Effects" menu will generate a spinning text of the effect name

# 4.31.4

- Dots are now supported in effect mapping names
  - e.g. `flags.token-variants.test="true"`

# 4.31.3

- Patch fix for periods not being supported in effect mapping names
  - If you wish to specify properties such as flags, bars `|` can be used instead
  - e.g. `flags|token-variants|test="true"`

# 4.31.2

- Left or Right-clicking the Effect Token Image while holding the "Config" key (Default: Shift) will now remove the image

# 4.31.1

- Fixed GM HUD Client settings merging with other players

# 4.31.0

- Major code restructuring, please do report any issues you come across
- Fixed overlays popping in corners before repositioning on the Token
- User To Image
  - Fixed momentary flicker of the original Token artwork when re-loading the scene
  - Tiles are now supported
    - `Shift-Right click` images in the `TileHUD` to bring up the menu

# 4.30.1

- Right-click support on PF2e Item Sheets

# 4.30.0

- Active Effect comparator support added for all Token properties
  - e.g. name, x, y, width, height, texture.src, etc.
  - Usage examples:
    - name="Raging Barbarian"
    - y<=2200
    - lockRotation="true"
- PF2e: Fixed "Dead" Status Effect application not being picked up by the module

# 4.29.1

- Adjusted `User To Image` feature logic to allow control of the image displayed to the user via the setting of a flag

```js
// Apply
token.document.setFlag('token-variants', 'userMappings', {
  user_id: 'image/file/path',
});
// Remove
token.document.setFlag('token-variants', 'userMappings', {
  '-=user_id': null,
});
```

e.g.

```js
// Apply
token.document.setFlag('token-variants', 'userMappings', {
  WHYKBy6W458lqeFE: 'TrickyImages/transparent.png',
});
// Remove
token.document.setFlag('token-variants', 'userMappings', {
  '-=WHYKBy6W458lqeFE': null,
});
```

# 4.29.0

- Fixed keybindings `Shift+1` and `Shift+3` not updating the Actor portrait
- Added a new setting to `User to Image` form: `Invisible Image`
  - Will render the token invisible for the non-gm users that have this image assigned to them

# 4.28.0

- Current Token and Default Wildcard images will now always be displayed in the Token HUD side menu
- Active Effect config scripts will now have **tvaUpdate** function exposed to them
  - When this function is used in the script TVA will defer the update to the script allowing you to execute the update after performing some other set of actions
  - An example use-case would be when combined with the `Sequencer` module:

```
new Sequence()
    .effect()
    .file("modules/JB2A_DnD5e/Library/Generic/Portals/Portal_Bright_Yellow_H_400x400.webm")
    .atLocation(token)
    .scaleToObject(4)
    .wait(1000)
    .thenDo(tvaUpdate)
    .play()
```

# 4.27.0

- New header button added to `Effect Config` window which allows saving of composite token and overlay image

# 4.26.1

- Randomizer sync image fix

# 4.26.0

- Token image randomization can now be configured per Actor
  - New button addon to the Token HUD side menu: **Randomizer**
  - When **Name Forge** module is active additional randomization options will be added:
    - Randomize Token Name
    - Models

# 4.25.0

- `Import` and `Export` header buttons have been added to Active Effect Configs
  - It is now possible to import and export both Global and Actor specific configs

# 4.24.0

- Added support for 'rotation' and 'elevation' attributes within the Effect Configs
  - e.g. `rotation>=180`
  - e.g. `elevation>0`
- Secret Feature still in development
  - Guess the key combination to unlock ;)

# 4.23.1

- Changing the manifest to point to master branch

# 4.23.0

**Active Effect Configuration**

- Effect names now accept any logical expression
  - Operators: `\(`, `\)`, `\!`, `&&`, `||`
  - e.g. `\(` Flying `&&` `\!` Prone `\)` `||` Levitating
  - These operators as well as `hp` comparators will be highlighted in the Effect Name textbox
- Global Configurations can now be set to apply on specific actor types

**Search Paths**

- JSON files can now be provided as **Search Path**
  - Credit goes to `p4535992`
  - Accepted format:

```
 {
   "name": "Alchemist's Fire",
   "path": "icons/consumables/potions/bottle-round-corked-yellow.webp",
   "tags": ["consumable", "alchemist", "fire"]
 },
 {
   "name": "Alchemist's supplies",
   "path": "icons/containers/bags/pouch-leather-green.webp",
   "tags": ["tool", "alchemist"]
 }
```

# 4.22.2

- Fixed hp comparators not working in composite effects containing regular effect names
  - e.g. hp<=50% && Shocked

# 4.22.1

- Fixed hp comparators not working as composite effects
  - e.g. hp>0 && hp<=50%

# 4.22.0

Active Effect Configuration

- Restrictions have been lifted on the data required for the config to be saved
  - Configs now only require the **Effect Name** to be filled out allowing global configs to be effectively disabled for a specific actor by just filling out an empty config
- Support added for composite active effect configs
  - **Effect Name** fields can now be filled out with a list of effects that all need to be active for the config to be applied
  - Effects are separated using `&&`
  - e.g. "Shocked && Frozen"
- New Overlay option added: **Appearance** > **Image Path**
  - Token image and overlay image can now be configured independently of each other
  - To not impact previously setup configurations, overlay **Image Path** will by default inherit the token image
  - Token image can now also be removed by clicking the middle mouse button

# 4.21.0

- Added a TMFX preset field to the Active Effect script configuration form

# 4.20.0

- `Preset` option added for TMFX overlay filter
  - Enables importing of preset parameters

# 4.19.0

- New setting: `Active Effects` > `Disable Token Animation`
  - Active Effect changes affecting Token appearance will not trigger core Foundry's Token animation.

# 4.18.2

- Fixed HP comparitors for the `Low Fantasy Gaming` system

# 4.18.1

- Fixed Item icon Right-click pop-up for the `Low Fantasy Gaming` system

# 4.18.0

- New setting available under **Active Effects**
  - Name: Disable image updates on manually changed tokens
  - Active Effect changes will not update images on tokens that have an image not corresponding to the prototype or any configurations.

# 4.17.0

- New setting available under **Active Effects**
  - Name: Disable image updates on Polymorphed
  - Active Effect configurations will not update images on tokens with polymorphed or wild shaped actors

# 4.16.0

- Item and Journal icon right-click pop-up can now be disabled via permissions
- Effect Mappings can now be set to always be on regardless of whether the effect with that name is applied or not

# 4.15.1

- Fix to prevent wildcard images from being re-randomized when toggling unrelated active effects

# 4.15.0

- Wildcard image support added for **Effect Configs**

# 4.14.0

- New setting: Display Token Effect Icons on Hover
  - When enabled effect icons will only be displayed while hovering over the token

# 4.13.1

- Improved the look of Overlay Config window

# 4.13.0

- With `Mass Edit >=v1.27.8` active Token Magic FX overlay filters will now provide a control to more conveniently edit filter parameters

# 4.12.0

- Added `Default Wildcard Image` field under Prototype Token Configuration
  - Available when 'Randomize Wildcard Images' is enabled
  - Will prevent the image from being randomized and instead set the it to this default upon token creation
  - Token HUD Wildcard default image will be used if it has previously been set

# 4.11.1

- Fixed error thrown with TMFX disabled

# 4.11.0

- Added support for `Token Magic FX` filters
  - When TMFX is active Overlays will now contain 'Token Magic FX' as a filter option
  - This filter accepts a TMFX params array

# 4.10.2

- Fixed another `Cyberpunk RED - Core` system related HP processing bug

# 4.10.1

- Fixed `Cyberpunk RED - Core` system related HP processing bug

# 4.10.0

- Fixed `Link To Token Data` -> `Rotation` option
- Added Visibility options to Overlay configuration
  - Always Visible
    - Overlay will be visible in explored areas of the map even when the Token is not
  - Limit Visibility to Users
    - Overlay will only be displayed to the selected list of users

# 4.9.0

- Added a control to duplicate Effect Configs
- Added `Relative` option under Overlay Animation
  - By default rotation is done around the centre of the token, with this option enabled it will be around the centre of the overlay
- Fixed `Underlay` option not placing `Overlays` underneath the token
- Fixed `Link To Token Data` -> `Opacity` option

# 4.8.0

- Controls added for the following filters:
  - Godray, KawaseBlur, OldFilm, Outline,Pixelate, RGBSplit, RadialBlur, Reflection
- New simulated effect added: `hp`
  - Allows to apply images, overlays, and configurations to tokens based on their current health
  - e.g. `hp<50%` will be applied when actors health drops bellow 50%
  - Accepts both percentages and exact values (e.g. `hp<=15`, `hp=100%`)
  - Accepted signs: `<, >, =, <=, >=`
  - HP effects with the same priority will overwrite each other, if you want multiple HP effects to be active at the same time set their priorities to unique values

# 4.7.0

> Note that some of these community filters will only be available if Token Magic FX is active.

- Controls added for the following overlay filters:
  - Alpha, Blur, BlurPass, Noise, Adjustment, AdvancedBloom, Ascii, Bevel, Bloom, BulgePinch, CRT, Dot, DropShadow, Emboss, Glitch, Glow

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
