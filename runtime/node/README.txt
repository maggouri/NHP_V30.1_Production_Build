Place a portable Node.js Windows binary here for PCs without a system Node install.

Expected file:
  runtime\node\node.exe

Optional (npm support):
  runtime\node\npm.cmd
  runtime\node\npx.cmd
  and the rest of an official Node Windows zip extract.

Download: https://nodejs.org/ (Windows Binary (.zip) LTS)
Extract so node.exe sits at:  <NHP_ROOT>\runtime\node\node.exe

NHP_Ensure_Node_In_Path.cmd will add this folder to PATH automatically.
Do not commit large Node binaries to git unless the team explicitly decides to.
