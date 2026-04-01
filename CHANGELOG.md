# Changelog

All notable changes to the "FlowRunner" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-04-01

### Added

- Event/Schedule triggers (file change watch, periodic execution)
- Shared variable store (setVar / getVar via Transform node)
- Copilot Chat integration (`@flowrunner /run`, `/list`, `/create`)
- Flow templates (save/create from template)
- Flow export/import (JSON)
- TryCatch node for error handling
- Parallel execution node (branch1/branch2/branch3 with Promise.all)
- Undo/Redo support
- Auto Layout (dagre-based left-to-right arrangement)
- Selection, Copy, Paste, Cut, Duplicate operations
- SubFlow output node selection
- User guide documentation (English / Japanese)
- Japanese README

### Changed

- Replaced `new Function()` with jexl-based safe expression evaluation
- Improved test coverage (719 tests, 74% statement coverage)

## [0.1.0] - 2026-03-29

### Added

- Initial release
- Flow creation, editing, deletion, and renaming
- Visual flow editor with node-based UI (React Flow)
- Flow execution and debug support
- Activity bar integration with flow list tree view
- Auto-save configuration
- Execution history management
- Internationalization support (English / Japanese)
