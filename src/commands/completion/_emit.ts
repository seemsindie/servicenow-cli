import type { CommandNode } from "./_walk.ts";

export function emitBash(nodes: CommandNode[], binName: string): string {
  // Build a case/esac that matches the previous-words chain.
  // Simple approach: flatten prefix "sn incident" → words after "sn" → "incident" lookup.
  const map: Record<string, string> = {};
  for (const n of nodes) {
    // Skip root entry; the top-level children come from the `sn` prefix entry
    const words = n.prefix.split(" ").slice(1); // drop the bin name
    map[words.join(" ")] = n.children.join(" ");
  }

  const entries = Object.entries(map)
    .map(([key, children]) => {
      const pattern = key === "" ? '""' : JSON.stringify(key);
      return `    ${pattern}) COMPREPLY=( $(compgen -W "${children}" -- "$cur") ) ;;`;
    })
    .join("\n");

  return `# bash completion for ${binName}
_${binName}_completion() {
  local cur prev words cword
  _get_comp_words_by_ref -n : cur prev words cword 2>/dev/null || {
    cur="\${COMP_WORDS[COMP_CWORD]}"
    words=("\${COMP_WORDS[@]}")
    cword=$COMP_CWORD
  }

  # Chain all words between the bin name and the current one, space-joined
  local chain=""
  for (( i=1; i<cword; i++ )); do
    if [[ -n "$chain" ]]; then chain="$chain \${words[i]}"; else chain="\${words[i]}"; fi
  done

  case "$chain" in
${entries}
    *) COMPREPLY=() ;;
  esac
}
complete -F _${binName}_completion ${binName}
`;
}

export function emitZsh(nodes: CommandNode[], binName: string): string {
  // zsh: translate the same map into _arguments-style completion
  const map: Record<string, string> = {};
  for (const n of nodes) {
    const words = n.prefix.split(" ").slice(1);
    map[words.join(" ")] = n.children.join(" ");
  }
  const entries = Object.entries(map)
    .map(([key, children]) => {
      const pattern = key === "" ? '""' : JSON.stringify(key);
      return `    ${pattern}) _values 'subcommand' ${children
        .split(" ")
        .map((c) => JSON.stringify(c))
        .join(" ")} ;;`;
    })
    .join("\n");

  return `#compdef ${binName}
_${binName}() {
  local chain=""
  local -a w
  w=(\${words[@]})
  for (( i=2; i<CURRENT; i++ )); do
    if [[ -n "$chain" ]]; then chain="$chain \${w[i]}"; else chain="\${w[i]}"; fi
  done
  case "$chain" in
${entries}
  esac
}
_${binName} "$@"
`;
}

export function emitFish(nodes: CommandNode[], binName: string): string {
  // fish: emit a complete line per prefix with -n conditions.
  const lines: string[] = [`# fish completion for ${binName}`];
  for (const n of nodes) {
    const words = n.prefix.split(" ").slice(1);
    const condition =
      words.length === 0
        ? `__fish_use_subcommand`
        : `__fish_seen_subcommand_from ${words[words.length - 1]}`;
    const scope =
      words.length === 0
        ? ""
        : ` -n '${condition}'`;
    for (const child of n.children) {
      lines.push(
        `complete -c ${binName}${scope} -a ${JSON.stringify(child)} -f`
      );
    }
  }
  return lines.join("\n") + "\n";
}
