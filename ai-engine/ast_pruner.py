"""
AST Code Chunking Module (Initial Prototype)
Basic line coordinate extraction from stack traces.
"""
import sys
import os

def prune_code_at_line(file_path: str, line_number: int, context_lines: int = 15) -> dict:
    if not os.path.exists(file_path):
        return {"error": "File not found", "file": file_path}

    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    start = max(0, line_number - context_lines)
    end = min(len(lines), line_number + context_lines)
    return {
        "file": file_path,
        "line": line_number,
        "snippet": "".join(lines[start:end]),
        "total_lines": len(lines)
    }

if __name__ == "__main__":
    if len(sys.argv) > 2:
        res = prune_code_at_line(sys.argv[1], int(sys.argv[2]))
        print(res)
