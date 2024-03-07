import CodeMirror from "codemirror";
import { removeQueryQuotes } from "@/lib/db/sql_tools";

export function autoquoteHandler(
  instance: CodeMirror.Editor,
  changeObj: CodeMirror.EditorChangeCancellable
) {
  if (!instance.getOption("mode").includes("pgsql")) return;

  // eslint-disable-next-line
  // @ts-ignore
  const { to, from, origin, text } = changeObj;

  // eslint-disable-next-line
  // @ts-ignore
  const keywords = CodeMirror.resolveMode(instance.getOption("mode")).keywords;

  // quote names when needed
  if (origin === "complete" && keywords[text[0].toLowerCase()] != true) {
    // eslint-disable-next-line
    // @ts-ignore
    const alias = instance.activeAlias;
    const names = text[0]
      .match(/("[^"]*"|[^.]+)/g)
      .map((n) => (/^\d/.test(n) && n !== alias ? `"${n}"` : n))
      .map((n) =>
        /[^a-z0-9_]/.test(n) && !/"/.test(n) && n !== alias ? `"${n}"` : n
      )
      .join(".");

    changeObj.update(from, to, [names]);
  }
}

function findSqlQueryIdentifierDialect(connectionType: string) {
  const mappings = {
    sqlserver: "mssql",
    sqlite: "sqlite",
    cockroachdb: "psql",
    postgresql: "psql",
    mysql: "mysql",
    mariadb: "mysql",
    tidb: "mysql",
    redshift: "psql",
  };
  return mappings[connectionType] || "generic";
}

export function removeQueryQuotesHandler(
  connectionType: string,
  instance: CodeMirror.Editor,
  e: ClipboardEvent
) {
  e.preventDefault();
  const dialect = findSqlQueryIdentifierDialect(connectionType);
  let clipboard = (e.clipboardData.getData("text") as string).trim();
  clipboard = removeQueryQuotes(clipboard, dialect);
  if (instance.getSelection()) {
    instance.replaceSelection(clipboard, "around");
  } else {
    const cursor = instance.getCursor();
    instance.replaceRange(clipboard, cursor);
  }
}

export function autocompleteHandler(
  instance: CodeMirror.Editor,
  e: KeyboardEvent
) {
  // TODO: make this not suck
  // BUGS:
  // 1. only on periods if not in a quote
  // 2. post-space trigger after a few SQL keywords
  //    - from, join
  const triggerWords = ["from", "join"];
  const triggers = {
    "190": "period",
  };
  const space = 32;
  if (instance.state.completionActive) return;
  if (triggers[e.keyCode]) {
    // eslint-disable-next-line
    // @ts-ignore
    CodeMirror.commands.autocomplete(instance, null, {
      completeSingle: false,
    });
  }
  if (e.keyCode === space) {
    try {
      const pos = _.clone(instance.getCursor());
      if (pos.ch > 0) {
        pos.ch = pos.ch - 2;
      }
      const word = instance.findWordAt(pos);
      const lastWord = instance.getRange(word.anchor, word.head);
      if (!triggerWords.includes(lastWord.toLowerCase())) return;
      // eslint-disable-next-line
      // @ts-ignore
      CodeMirror.commands.autocomplete(instance, null, {
        completeSingle: false,
      });
    } catch (ex) {
      // do nothing
    }
  }
}

export function registerAutoquote(
  instance: CodeMirror.Editor,
  onBeforeChange?: (
    instance: CodeMirror.Editor,
    changeObj: CodeMirror.EditorChangeCancellable
  ) => void
) {
  instance.on("beforeChange", onBeforeChange ?? autoquoteHandler);
  return () => instance.off("beforeChange", onBeforeChange ?? autoquoteHandler);
}

export function registerAutoRemoveQueryQuotes(
  dialect: string,
  instance: CodeMirror.Editor
) {
  const handler = removeQueryQuotesHandler.bind(null, dialect);
  instance.on("paste", handler);
  return () => instance.off("paste", handler);
}

export function registerAutoComplete(instance: CodeMirror.Editor) {
  instance.on("keyup", autocompleteHandler);
  return () => instance.off("keyup", autocompleteHandler);
}

export default {
  registerAutoquote,
  registerAutoComplete,
  registerAutoRemoveQueryQuotes,
};
