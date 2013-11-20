MoneyAI.JS
==========

Build (Windows)
---------------
0. Install TypeScript (just for VS project)
1. Install node.js from http://nodejs.org/
2. Reopen the command prompt (kill explorer instances if needed) and type
	npm install grunt-cli -g
	npm install bower -g
3. Switch to folder MoneyInMotion\MoneyAI.JS
4. Type following commands
	bower update
	npm install
	grunt
5. Start webserver for MoneyInMotion\MoneyAI.JS folder. For IIS, make sure you have json mime type added as application/json.
6. You need files in MoneyInMotion\MoneyAI.JS\data folder which is mysteriously not provided. To get this files, run MoneyAI.WinForms project, drop in your account files, scan, save merged files and copy them over to data folder.
 
 Issues
 -------
 1. npm is not available from command line
	Kill explorer windows, start command prompt again.
 2. bower update shows error such as 
	'ECMDERR Failed to execute "git ls-remote --tags --heads git://github...'
	First run bower prune to clean up existing files.
	Then make sure git is latest (1.8.4+) from http://git-scm.com/download/win
	
 