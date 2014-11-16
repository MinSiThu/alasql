/*
//
// Database class for Alasql.js
// Date: 03.11.2014
// (c) 2014, Andrey Gershun
//
*/

// Main function
alasql = function(sql, params, cb, scope) {
	return alasql.exec(sql, params, cb, scope);
};

// Initial parameters
alasql.parser = parser;
alasql.parse = parser.parse.bind(parser); // Shortcut

// Useful library
alasql.utils = utils;

alasql.databases = {};

// Cache
alasql.MAXSQLCACHESIZE = 10000;
alasql.DEFAULTDATABASEID = 'alasql';

alasql.use = function (databaseid) {
	if(!databaseid) databaseid = alasql.DEFAULTDATABASEID;
	if(alasql.useid == databaseid) return;
	alasql.useid = databaseid;
	var db = alasql.databases[alasql.useid];
	alasql.tables = db.tables;
	db.resetSqlCache();
};

// Run one statement
alasql.exec = function (sql, params, cb) {
	return alasql.dexec(alasql.useid, sql, params, cb);
}

alasql.dexec = function (databaseid, sql, params, cb) {
	var db = alasql.databases[databaseid];
	var hh = hash(sql);
	var statement = db.sqlCache[hh];
	if(statement && db.dbversion == statement.dbversion) {
		return statement(params, cb);
	}

	// Create AST
	var ast = alasql.parse(sql);
	if(!ast.statements) return;
	if(ast.statements.length == 0) return 0;
	else if(ast.statements.length == 1) {
		if(ast.statements[0].compile) {
			var statement = ast.statements[0].compile(databaseid);
			if(!statement) return;
			statement.sql = sql;
			statement.dbversion = db.dbversion;
			
			// Secure sqlCache size
			if (db.sqlCacheSize > alasql.MAXSQLCACHESIZE) {
				db.resetSqlCache();
			}
			db.sqlCacheSize++;
			db.sqlCache[hh] = statement;
			var res = statement(params, cb);
			return res;
		} else {
			return ast.statements[0].execute(databaseid, params, cb);		
		}
	} else {
		// Multiple statements
		return alasql.drun(databaseid, ast, params, cb);
	}
};

// Run multiple statements and return array of results
alasql.drun = function (databaseid, ast, params, cb) {
	var useid = alasql.useid;
	if(useid != databaseid) alasql.use(databaseid);
	var res = [];
	for (var i=0, ilen=ast.statements.length; i<ilen; i++) {
		if(ast.statements[i].compile) { 
			var statement = ast.statements[i].compile(alasql.useid);
			res.push(statement(params));
		} else {
			res.push(ast.statements[i].execute(alasql.useid, params));
		}		
	};
	if(useid != databaseid) alasql.use(useid);
	if(cb) cb(res);
	return res;
};

// Compiler
alasql.compile = function(sql, kind, databaseid) {
	if(!kind) kind = 'collection';
	if(!databaseid) databaseid = alasql.useid;
	var ast = alasql.parse(sql);
	if(ast.statements.length == 1) {
		var statementfn = ast.statements[0].compile(databaseid);
		
		if(kind == 'value') {
			return function(params,cb) {
				var res = statementfn(params,cb);
				var key = Object.keys(res)[0];
				return res[0][key];
			};
		} else  if(kind == 'single') {
			return res[0];
		} else  if(kind == 'row') {
			var a = [];
			for(var key in res[0]) {
				a.push(res[0][key]);
			};
		} else  if(kind == 'column') {
			var ar = [];
			var key = Object.keys(res)[0];
			for(var i=0, ilen=res.length; i<ilen; i++){
				ar.push(res[i][key]);
			}
		} else if(kind == 'array') {
			return flatArrya(res);
		} else if(kind == 'matrix') {
			return arrayOfArrays(res);
		} else if(kind == 'collection') {
			return statementfn;
		} else {
			return statementfn;
		}

	} else {
		throw new Error('Number of statments in SQL is not equal to 1');
	}
}

// // Default methods to exec SQL statements
// alasql.run = alasql.exec = function (sql, params, cb) {
// 	return this.currentDatabase.exec(sql, params, cb);
// };

// Promised version of exec
alasql.aexec = function (sql, params) {
	var self = this;
	return new Promise(function(resolve, reject){
		self.exec(sql,params,resolve);
	});
};


// MSSQL-Like aliases
alasql.query = function (sql, params, cb) {
	var res = this.exec(sql, params);
	if(cb) cb(res);
	return res;	
};

alasql.queryArray = function (sql, params, cb) {
	var res = flatArray(this.exec(sql, params));
	if(cb) cb(res);
	return res;
};

alasql.querySingle = function (sql, params, cb) {
	var res = this.exec(sql, params)[0];
	if(cb) cb(res);
	return res;
};

alasql.queryRow = function (sql, params, cb) {
	var res = this.querySingle(sql, params);
	var a = [];
	for(var key in res) {
		a.push(res[key]);
	};
	if(cb) cb(a);
	return a;
};

alasql.queryValue = function (sql, params, cb) {
	var res = this.exec(sql, params)[0];
	var val = res[Object.keys(res)[0]];
	if(cb) cb(val);
	return val;
	// TODO Refactor to query.columns
};

alasql.queryArrayOfArrays = function (sql, params, cb) {
	var res = this.queryArrayOfArrays(sql, params);
	if(cb) cb(res);
	return res;
};

alasql.value = alasql.queryValue;
alasql.single = alasql.querySingle;
alasql.row = alasql.queryRow;
alasql.array = alasql.queryArray;
alasql.matrix = alasql.queryArrayOfArrays;

