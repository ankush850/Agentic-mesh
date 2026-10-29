"""
AST Code Chunking Module
Extracts precisely the failing function/method and its context from source code
based on line coordinates from stack traces, eliminating token bloat for LLMs.
"""

import sys
import os
import re
import json

def prune_code_at_line(file_path: str, line_number: int, context_lines: int = 15) -> dict:
    if not os.path.exists(file_path):
        return {
            "file": file_path,
            "line": line_number,
            "snippet": f"File not found: {file_path}",
            "enclosing_symbol": "unknown"
        }

    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    except Exception as e:
        return {"error": str(e), "file": file_path}

    total_lines = len(lines)
    idx = line_number - 1  # 0-indexed

    start = max(0, idx - context_lines)
    end = min(total_lines, idx + context_lines + 1)

    # Detect enclosing function or block via indentation / regex pattern
    enclosing_symbol = "global"
    func_pattern = re.compile(r"^\s*(?:async\s+)?(?:def|function|public|private|protected|const|let)\s+([a-zA-Z0-9_]+)")
    for i in range(idx, -1, -1):
        if i < len(lines):
            match = func_pattern.search(lines[i])
            if match:
                enclosing_symbol = match.group(1)
                start = max(0, i - 2)
                break

    snippet_lines = lines[start:end]
    annotated = []
    for curr_line_no, line_content in enumerate(snippet_lines, start=start + 1):
        marker = " >>> " if curr_line_no == line_number else "     "
        annotated.append(f"{curr_line_no:4d}{marker}{line_content.rstrip()}")

    return {
        "file": file_path,
        "line": line_number,
        "enclosing_symbol": enclosing_symbol,
        "start_line": start + 1,
        "end_line": end,
        "total_lines": total_lines,
        "snippet": "\n".join(annotated)
    }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python ast_pruner.py <file_path> <line_number>"}))
        sys.exit(1)

    target_file = sys.argv[1]
    target_line = int(sys.argv[2])
    result = prune_code_at_line(target_file, target_line)
    print(json.dumps(result, indent=2))
