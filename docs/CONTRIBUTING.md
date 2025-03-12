# vscode-copilot-lean4 Contribution Guide

This extension aims to provide the backbone for Copilot extensions for Lean 4 and Mathlib4.
It also provides a Chat Participant `id : "lean4.copilot"` with the name "lean4Copilot" and additional details about its functionality.

## Norms, Conventions, etc.

### Prompts
Are composed using `@vscode/prompt-tsx` and represented as trees of TSX components which then get flattened into `ChatMessages`.
These may contain `TextChunk`s to make prioritization more granular.

#### Components

TODO: implement - 
For the `Lean4Prompt` we have the following components:

- `SystemPrompt` - A Customizable Prompt to explain the models role and behavior.
- `UserPrompt` - The text input from the user.
- `References` - A container for references.
    - `UserReferences` - A container for user invoked references.
    - `SystemReferences` - A container for system invoked references.
- `History` - A container for previous components.
    - `ChatHistory` - The history containing only Questions and Answers.
    - `UserReferencesHistory` - A container for previous user invoked references.
    - `SystemReferencesHistory` - Previous `SystemReferences`.

For a mwe we reduce it to the following components:

- `SystemPrompt`
- `UserPrompt`
- `ChatHistory`

##### Component structure

Each component consists of extensions of
- `BasePromptElement` containing
    - `defaultProps` to set the default values for optional arguments.
    - `render()` to render the component.

- `BaseElementProps` containing the (optional) arguments passed to the component.

#### Component Prioritization

To prioritize components there is the `priority` where bigger numbers mean higher priority. We use the range from 0 to 100.

- 99 `SystemPrompt`
- 100 `UserPrompt`
- 90 `UserReferences`
- 80 descending `ChatHistory`
- 70 descending `SystemReferences`
- 60 descending `SystemHistory`

Where descending means that the priority of older messages is lower, Rate tbd TODO.


### Import order

In general from most general and public to most specific and local. This is the order of imports:
```
// Core Librarys
// 3rd Party Librarys
// Local Librarys/Modules/.../LocalFiles
```

### Logging

There is a `Logger` class that can be used to log messages. There are the following log levels:
- `debug`
- `info`
- `warn`
- `error`

