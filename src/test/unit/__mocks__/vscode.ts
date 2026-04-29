/**
 * VSCode API mock for unit testing with vitest
 */

export class EventEmitter<T> {
  private handlers: Array<(e: T) => void> = [];

  event = (handler: (e: T) => void) => {
    this.handlers.push(handler);
    return { dispose: () => { this.handlers = this.handlers.filter((h) => h !== handler); } };
  };

  fire(data: T) {
    this.handlers.forEach((h) => h(data));
  }

  dispose() {
    this.handlers = [];
  }
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class TreeItem {
  label?: string;
  id?: string;
  description?: string;
  collapsibleState?: TreeItemCollapsibleState;
  contextValue?: string;

  constructor(
    label: string,
    collapsibleState?: TreeItemCollapsibleState
  ) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class Uri {
  static file(path: string): Uri {
    return new Uri("file", "", path, "", "");
  }

  static parse(value: string): Uri {
    return new Uri("", "", value, "", "");
  }

  static joinPath(base: Uri, ...pathSegments: string[]): Uri {
    const joined = [base.fsPath, ...pathSegments].join("/");
    return Uri.file(joined);
  }

  constructor(
    public readonly scheme: string,
    public readonly authority: string,
    public readonly path: string,
    public readonly query: string,
    public readonly fragment: string
  ) {}

  toString(): string {
    return `${this.scheme}://${this.path}`;
  }

  get fsPath(): string {
    return this.path;
  }
}

export const window = {
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  setStatusBarMessage: vi.fn(() => ({ dispose: vi.fn() })),
  showInputBox: vi.fn(),
  showQuickPick: vi.fn(),
  showSaveDialog: vi.fn(),
  showOpenDialog: vi.fn(),
  createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(),
    append: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn(),
  })),
  createWebviewPanel: vi.fn(),
  registerTreeDataProvider: vi.fn(),
  createStatusBarItem: vi.fn(() => ({
    text: "",
    tooltip: "",
    command: undefined as string | undefined,
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  })),
};

export const commands = {
  registerCommand: vi.fn(),
  executeCommand: vi.fn(),
};

export const workspace = {
  workspaceFolders: undefined as { uri: Uri }[] | undefined,
  fs: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    delete: vi.fn(),
    readDirectory: vi.fn(),
    createDirectory: vi.fn(),
    stat: vi.fn(),
  },
  getConfiguration: vi.fn(() => ({
    get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue),
    update: vi.fn(),
  })),
  onDidChangeConfiguration: vi.fn(),
  createFileSystemWatcher: vi.fn(() => ({
    onDidCreate: vi.fn(),
    onDidChange: vi.fn(),
    onDidDelete: vi.fn(),
    dispose: vi.fn(),
  })),
};

export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3,
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

export class RelativePattern {
  constructor(
    public readonly base: string | Uri | { uri: Uri; name: string },
    public readonly pattern: string,
  ) {}
}

export class Disposable {
  static from(...disposables: { dispose(): void }[]): Disposable {
    return new Disposable(() => {
      disposables.forEach((d) => d.dispose());
    });
  }

  constructor(private callOnDispose: () => void) {}

  dispose() {
    this.callOnDispose();
  }
}

export const lm = {
  selectChatModels: vi.fn().mockResolvedValue([]),
};

export class LanguageModelChatMessage {
  static User(content: string) {
    return { role: "user", content };
  }
  static Assistant(content: string) {
    return { role: "assistant", content };
  }
}

export class CancellationTokenSource {
  token = { isCancellationRequested: false, onCancellationRequested: vi.fn() };
  cancel() { this.token.isCancellationRequested = true; }
  dispose() {}
}

export const env = {
  language: "en",
};

export const l10n = {
  t: vi.fn((message: string) => message),
};
