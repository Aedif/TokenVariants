![GitHub Latest Version](https://img.shields.io/github/v/release/Aedif/TokenVariants?sort=semver)
![GitHub Latest Release](https://img.shields.io/github/downloads/Aedif/TokenVariants/latest/token-variants.zip)
![GitHub v9 Release](https://img.shields.io/github/downloads/Aedif/TokenVariants/3.10.4/token-variants.zip)
![GitHub All Releases](https://img.shields.io/github/downloads/Aedif/TokenVariants/token-variants.zip)
[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Ftoken-variants)](https://forge-vtt.com/bazaar#package=token-variants)

# Token Variant Art

Improve management of Token art in-session and during prep.

This module searches a customizable list of directories and makes found art available through various convenient means such as pop-ups and a new Token HUD button.

Main features include:

- Sourcing images from local folders, rolltables, Imgur galleries, and s3 buckets
- Pop-ups on Actor/Token create to select images found based on Actor/Token name
- Overlaying images/videos on top or bellow the token ([examples](https://github.com/Aedif/TokenVariants/wiki/Templates))
- Sharing specific art with players through the Token HUD allowing them to switch out their token art on the fly
- Displaying different images for the same token for each user
- Image filtering based on identifiers e.g. when selecting a portrait only showing images containing 'PRT': Bob[PRT].png, Tom[PRT].png
- Wildcard images shown in the Token HUD
- Aided and/or automatic mapping of images to actor compendiums
- Assigning art to status effects and Visibility/Combat states, updating tokens once conditions such as 'Dead' and 'Paralysis' have been applied
- Assigning custom token configuration (token scale, vision, name etc.) to images which are applied upon image selection through the Token HUD

For the comprehensive list of settings and features checkout the module's [wiki](https://github.com/Aedif/TokenVariants/wiki).

Watch a short feature showcase on YouTube:

[![Watch the video](https://img.youtube.com/vi/S1O8CDksagM/hqdefault.jpg)](https://youtu.be/S1O8CDksagM)

Watch a video guide to help setup main module features:
https://youtu.be/r3bK0UEBAL4

You can support me on [Patreon](https://www.patreon.com/Aedif). In addition to helping me to continue working on FoundryVTT modules you will be granted access to a selection of pre-configured animated overlays to be used along with this module:

!["Animated Overlays"](./docs/animated_overlays.gif)

## Image to User mappings

Images displayed in the Token HUD can be Shift-Right clicked to open a window that allows you to map an image to be displayed to a specific user.

!["User Image Mapping"](./docs/user_to_image.png)

## Pop-up and Randomizer override

By Shift+Left-clicking the Token HUD button you are able to override certain module features for the specific token/actor.

!["Setting Override"](./docs/override.png)

### Global and Actor Mappings

The module allows for application of token configurations, running of scripts, display of overlays, and more based on conditions defined via expressions. The mapping menu is accessed by:

Actor Mappings
- Shift-Left Clicking the `Toggle Visibility State`, `Assign Status Effects`, or `Toggle Combat State` buttons on the Token HUD
- Right-clicking the newly added TVA button on the Token HUD and selecting `Effect Config`

Global Mappings
- Using the `Shift+G` shortcut
- Going to module settings and selecting `Global Effect Configurations` under `Active Effects`
- Selecting `Open Global` header button from the `Actor Mappings` form

![image](https://github.com/Aedif/TokenVariants/assets/7693704/7f5f25e3-a7c7-4582-9f73-e6c3dc9d4e8f)

- `Label` is just a descriptor for your benefit
- `Expression` is the condition that will trigger configurations on the right-side of the entry to be executed:
  - `Image` if set will update the token image
  - `Config` will apply `Token Configuration` or `Run a Script`
  - `Overlay` will display and Image, Text, or Shape on the token
- `Always On` will make the `Expression` always evaluate as true
- `Disable` will make the `Expression` always evaluate as false
- `Group` places mappings under the same header allowing them to be `Disable`d en masse and collapsed.

#### Expressions

- Accepted Operators:
  - `&&` ( logical AND)
  - `||` (logical OR)
  - `\!` (escaped logical NOT)
  - `\(` (escaped open bracket to group expressions)
  - `\)` (escaped closed bracket to group expressions)

- Accepted hp and Token property Comparators:
  - `=` (equal)
  - `<` (less than)
  - `>` (greater than)
  - `<=` (less than or equal)
  - `>=` (greater than or equal)
  - `<>` (lesser or greater than)

- Accepted wildcards
  - `\*`
  - `\{  \}`

##### Examples of valid expressions:
- `Flying`
- `Dead && Burning`
- `Flying && \! \( Prone || Dead \)`
- `hp<=50%`
- `name="Raging Barbarian"`
- `lockRotation="true"`
- `flags.token-variants.test="true"`
- `Exhaustion \*`
- `Exhaustion \{1,2,3\}`

##### Special Effect Names:
- `token-variants-combat` : Actives when Token is in combat
- `combat-turn` : Activates when it's Token's turn in combat
- `combat-turn-next` : Actives when Token is next in the initiative order

## Installation

To install, import this [manifest](https://raw.githubusercontent.com/Aedif/TokenVariants/master/module.json) into the module browser or search for 'Token Variant Art'.
