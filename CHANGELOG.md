# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased]

### Added
### Changed
- adding environmental variables to serverConfig.ts for jitsi server url (serviceUrl) to be either set in .env.local files by yourself or passed on `npm run start` or `npm run build` directly. So either add `SERVICE_URL = "url-of-your-jitsi-installation"` to your .env files (also to .env.development to be run during dev) or pass it like `SERVICE_URL=url-of-your-jitsi-installation npm run start`;
### Fixed
### Removed

## [0.6] 2021-03-04 

### Added
- Doc Folder for Documentation 
- Added CONTRIBUTION.md 
- Added INSTALL.md

### Changed
- Adjusted Readme.md to be an Overview
- Added gif of chatmosphere in use

### Fixed
- Updated Storybook to last version; they are using an old immer install but since we're not using storybook in our app itself this is no problem.
- Fixed Bug where Session Name with capital letters caused error

### Removed
- openmoji npm package because it's huuuge; we added used icons in /assets folder

## [0.5.9] 2021-02-06

### Added
  - Added meta description in index.html (thx @bumi)

### Changed
  - Certificates are now linked in .env.development so it should also run on windows (Thanks @XristophD)
  - 

### Fixed
  -
### Removed

## [0.5.8] - 2021-01-28

### Added
  - preferred Codec to be H265 in Options; it should switch the videoCodec to H265 instead of VP8, not sure if this is used though; maybe it needs to be set on server

### Changed
  - AudioRadius is now 650px; if its more it feels quite weird :)


## [0.5.7] - 2021-01.28

### Added
  - Kitty Icons for Mute
  - finished Color Variables for Theming
  - commented way to throttle pan and drag updates; thus its not updating the store that fast but with an delay of 200ms; should be checked and uncommented if we like it

### Changed
  - Input Field under users is now more consistent
  - Social Icons have theme colors

### Fixed
  - Button Story in Storyboard

### Removed

## [0.5.6] - 2021-01-27

### Added
  - Added a changelog to track our releases :)

### Changed
  - bumped version to 0.5.6
  - Interim Enter Screen is omitted for now since it's currently more confusing than helpful; 
    so after Welcome one is direcly in the session/call; 
    we know some people are irritated that they are directly visible with video; we will target that with the enter screen in future releases


### Fixed
  - No Videos where shown after camera permission request; hopefully fixed for now. 
  - Potential Vulnerability in immer lib - updated to 8.0.1
  - Dragging Position, meaning the position of the current user, is now truncated to integer; (float values cannot be displayed by browsers anyways)

### Removed
  - uncommented the "Video" Button/Control in Footer because its not implemented yet

