export default {
  "*": "prettier --check --ignore-unknown",
  "*.{js,ts,tsx}": "oxlint",
  "*.md": "remark --frail --quiet --no-stdout",
};
