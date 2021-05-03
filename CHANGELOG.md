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