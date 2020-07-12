const http = require("http"); //import package of web server
const url = require("url"); //import package of url parsing

module.exports = {
  wdSymbol: class WdSymbol {
    constructor(symbol, symbolReg, alias) {
      this.symbol = symbol; //string, express of symbol
      this.symbolReg = symbolReg; //reg express for catching symbol, the param should in one group, e.g. /{{(\w)}}/
      this.alias = alias || symbol;
      // this.partial = false; //boolean, true means partisl phase is symbol
    }
    has(path) {
      return this.symbolReg.test(path);
      W;
    }
    getParams(phase) {
      //phase is except /
      let reg = new RegExp(this.symbolReg, "g");
      let params = [];
      let param; //can be param name or value

      while ((param = reg.exec(phase))) {
        params.push(param[1]); //[1] is first parenthesized substring match
      }
      return params;
    }
    getRule(phase) {
      let reg = new RegExp(this.symbolReg, "g");
      let rule = new RegExp(phase.replace(reg, "(\\w+?)")); //\w need \ escape
      return rule;
    }
  },
  pathRule: class PathRule {
    constructor(pathRule, wdList, process) {
      this.pathRule = pathRule;
      this.wdList = wdList || null;
      this.phaseReg = /(?<=\/)(.+?)(?=\/|$)/g;
      this.rules = this.parseRule(pathRule);
      this.process = process;
    }
    //e.g. /image/:page/:id
    //{
    //pathRule : '/image/:page/:id',
    //wdList : [], //wildcard object list
    //phaseReg : /(?<=\/)(.+?)(?=\/|$)/g,
    //rules = {
    //  root : '/image', //path root
    //  rules : [
    //        {phase : 'image', phaseIndex : 0, wd : []},
    //        {phase : ':page', phaseIndex : 1, wd : [{wdSymbol : ':', rule ：/:(\w+?)/, params : ['page']}]},
    //        {phase : ':page', phaseIndex : 2, wd : [{wdSymbol : ':', rule ：/:(\w+?)/, params : ['id']}]}
    //]，
    //wdIndex : 1 //first wildcard index, here :page is wildcard, in phase 1
    //}
    //process : function(){} //function to handle incoming visiting
    //}
    parseRule(pathRule) {
      let rules = {
        root: "",
        rules: [],
        wdIndex: 0,
      };
      if (this.wdList instanceof Array) {
        let rootFlag = true;
        let phase = pathRule.match(this.phaseReg);
        for (let len = phase.length, i = 0; i < len; i++) {
          let rule = {};
          rule.phase = phase[i];
          rule.phaseIndex = i;
          rule.wd = [];
          for (let len = this.wdList.length, l = 0; l < len; l++) {
            if (this.wdList[l].has(phase[i])) {
              rule.wd.push({
                wdSymbol: this.wdList[l].symbol,
                rule: this.wdList[l].getRule(phase[i]),
                params: this.wdList[l].getParams(phase[i]),
              });
            }
          }
          if (rootFlag && rule.wd.length === 0) {
            rules.root = rules.root + "/" + phase[i];
            rules.wdIndex++;
          } else {
            rootFlag = false;
          }
          rules.rules.push(rule);
        }
      } else {
        rules.root = pathRule;
      }
      return rules;
    }
    parsePath(path) {
      let root = this.rules.root;
      let params = [];
      if (this.wdList instanceof Array) {
        let phases = path.match(this.phaseReg);
        for (
          let len = this.rules.rules.length, i = this.rules.wdIndex;
          i < len;
          i++
        ) {
          let param = {};
          for (let len = this.rules.rules[i].wd.length, l = 0; l < len; l++) {
            let values = phases[i].match(this.rules.rules[i].wd[l].rule) || [];
            console.log("values", values, i, l);
            for (let len = values.length, m = 1; m < len; m++) {
              if (typeof values[m] === "object") {
                break;
              } else {
                params.push({
                  [this.rules.rules[i].wd[l].params[m - 1]]: values[m],
                });
              }
            }
          }
        }
      }
      return { root: root, params: params };
    }
    addProcess(func) {
      //function(req,res) {}
      this.process = func;
    }
    defaultProcess(req, res) {
      res.writeHead(200, {
        "Content-Type": mime.getType("text"),
      });
      res.end(`hello, I'm severlet`);
    }
  },
  createServer: class CreateServer {
    constructor(port) {
      this.port = port;
      //init wildcard
      this.wdList = [
        new module.exports.wdSymbol(":", /:(\w+)/, "colon"),
        new module.exports.wdSymbol("{{}}", /(?:{{)(\w+)(?:{{}})/, "dblBraces"),
      ];
      this.preHandleList = [];
      this.pathList = [];
      this.postHandleList = [];
      this.handler.bind(this);
      this.preHandler.bind(this);
      this.postHandler.bind(this);
      this.server = http.createServer();
    }
    run() {
      this.server.on("request", (req, res) => {
        let p = Promise.resolve();
        p.then(() => {
          return this.preHandler(req, res);
        })
          .then(() => {
            return this.handler(req, res);
          })
          // .then(this.postHandler(req, res))
          .then(() => {
            this.endHandler(req, res);
          });
      });
      this.server.listen(this.port);
    }
    preHandler(req, res) {
      let that = this;
      let p = Promise.resolve();
      for (let len = that.preHandleList.length, i = 0; i < len; i++) {
        p = p.then(function () {
          return new Promise(function (resolve, reject) {
            console.log("in handler");
            that.preHandleList[i](req, res, function (data) {
              resolve();
            });
          });
        });
      }
      return p;
    }

    handler(req, res) {
      let that = this;
      let pathname = url.parse(req.url).pathname;

      let p = Promise.resolve();
      for (let len = that.pathList.length, i = 0; i < len; i++) {
        p = p.then(function () {
          return new Promise(function (resolve, reject) {
            console.log("in handler");
            that.pathList[i].process[req.method](req, res, function (data) {
              resolve();
            });
          });
        });
      }
      return p;
    }

    postHandler(req, res) {
      let that = this;
      let p = Promise.resolve();
      for (let len = that.postHandleList.length, i = 0; i < len; i++) {
        p = p.then(function () {
          return new Promise(function (resolve, reject) {
            that.postHandleList[i](req, res, function (data) {
              resolve();
            });
          });
        });
      }
      return p;
    }

    endHandler(req, res) {
      console.log("endHandler");
      res.end();
    }

    defaultHander(req, res) {
      res.send("defalut");
    }

    addWd(wd) {
      for (let len = this.wdList.length, i = 0; i < len; i++) {
        if (wd.symbol == this.wdList[i]["symbol"]) {
          return this.wdList;
        }
      }
      return this.wdList.push(wd);
    }
    regPath(pathObj) {
      if (pathObj instanceof module.exports.pathRule) {
        this.pathList.push(pathObj);
      }
    }
    removePath(pathObj) {
      let index = this.pathList.indexOf(pathObj);
      this.pathList.splice(index, 1);
    }
    regPreHandle(func) {
      if (func instanceof Function) {
        this.preHandleList.push(func);
      }
    }
    removePreHandle(func) {
      let index = this.preHandleList.indexOf(func);
      this.preHandleList.splice(index, 1);
    }
    regPostHandle(func) {
      if (func instanceof Function) {
        this.postHandleList.push(func);
      }
    }
    removePostHandle(func) {
      let index = this.postHandleList.indexOf(func);
      this.postHandleList.splice(index, 1);
    }
  },
  pathProcess: class PathProcess {
    constructor(methods) {
      for (let key in methods) {
        this[key.toUpperCase()] = methods[key];
      }
    }
    process(req, res) {
      console.log(req.method, typeof req.method);
      console.log(this);
      this[req.method](req, res);
    }
    addMethod(method, func) {
      this[method] = func;
    }
  },
};
