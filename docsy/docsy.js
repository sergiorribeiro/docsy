window.docsy = {
    version: {
        major:"1",
        minor:"0",
        revision:"4a",
        toString: () => {let v = window.docsy.version; return `${v.major}.${v.minor}.${v.revision}` }
    },
    current: {
        page: "",
        debugging: false
    },
    toggleDebugging: function(toggle){
        let ps = document.querySelector("#pagestage");
        ps.classList.remove("debugging");
        docsy.current.debugging = toggle;
        if(toggle)
            ps.classList.add("debugging");
    }
}

function getAsync(url, callback) {
    let xhr = new XMLHttpRequest();
    xhr.onload = function () {
        if(xhr.status==404)
            callback(
                "<missingblock>missing resource: <span>"+ url.substring(url.indexOf("/")+1,url.indexOf(".docsyml")) +"</span></missingblock>"
            );
        else
            callback(this.responseText);
    };
    xhr.onerror = function () {
        callback("");
    };
    url += `${(url.indexOf("?")==-1) ? "?" : "&"}${Math.random().toString(36).substring(2) + (new Date()).getTime().toString(36)}`;
    xhr.open("GET", url, true);
    xhr.send();
}

function buildTree(d,container,level) {
    let node = document.createElement("div");
    let wrapper = document.createElement("div");
    let tick = document.createElement("div");
    let text = document.createElement("div");
    let cc = document.createElement("div");

    tick.classList.add("tick");
    wrapper.classList.add("wrapper");
    if(level == 1)
        node.classList.add("root");
    node.classList.add("node");
    cc.classList.add("childrencontainer");
    cc.dataset.state = "closed";
    text.classList.add("text");
    text.dataset.page = d.page;


    text.innerText = d.title;
    tick.addEventListener("click",x=> {
        let ct = x.target.parentNode.parentNode.querySelector(".childrencontainer");

        if(ct.dataset.state == "closed"){
            ct.dataset.state = "opened";
            tick.style.transform = "rotate(180deg)";
            tick.style.opacity = 1;
        }else{
            ct.dataset.state = "closed";
            tick.style.transform = "rotate(90deg)";
            tick.style.opacity = 0.5;
        }
    });

    text.addEventListener("click",x => {
        loadPage(x.target.dataset.page);
    });

    if(d.children && d.children.length > 0){
        d.children.forEach(x => {
            buildTree(x,cc,level+1);
        });
    }else{
        tick.classList.add("-nochildren");
    }

    wrapper.append(tick);
    wrapper.append(text);
    node.append(wrapper);
    node.append(cc);
    container.append(node);
}

function loadPage(page) {
    docsy.current.page = page;
    getAsync(`/pages/${page}.docsyml`,
        x => {
            for(let k in window.constants)
                x = x.replace(new RegExp(`{{${k}}}`,"g"),window.constants[k]);
            document.querySelector("#pagemarkup").innerHTML = x;
            buildPage();
        });
}

function resizePanes() {
    window.ix.style.width = "calc("+window.ix.dataset.width+"% - 2px)";
    window.ps.style.width = "calc("+window.ps.dataset.width+"% - 2px)";
}

function loadDescriptor(d) {
    let ixw = d.configs.indexWidth;
    let psw = 100 - ixw;
    window.constants = d.constants;
    window.ix.dataset.width = ixw;
    window.ps.dataset.width = psw;
    if(d.configs.debugMode)
        docsy.toggleDebugging(true);
    resizePanes();

    let index = document.querySelector("#index");
    d.pages.forEach(x => {
        buildTree(x,index,1);
    });
}

function buildPage() {
    let ps = document.querySelector("#pagestage");
    let ml = document.querySelector("#pagemarkup");
    ps.innerHTML = ml.innerHTML;
    ml.innerHTML = "";
    window.bc = 0;
    let blocks = ps.querySelectorAll("block[name]");
    if(blocks.length == 0)
        unfoldDocsyml();
    else
        loadBlocks(ps);
}

function loadBlocks(ml){
    ml.querySelectorAll("block[name]").forEach(x => {
        window.bc++;
        getAsync(`/blocks/${x.getAttribute("name")}.docsyml`, j => {
            x.innerHTML = j;
            x.removeAttribute("name");
            window.bc--;

            if(x.querySelectorAll("block[name]").length > 0){
                loadBlocks(ml);
            }else{
                if(window.bc == 0)
                    unfoldDocsyml();
            }
        })
    });
}

function unfoldDocsyml() {
    let ml = document.querySelector("#pagestage");

    // fold
    ml.querySelectorAll("openedfold,closedfold").forEach(x => {
        if(x.tagName.toLowerCase() == "openedfold")
            x.setAttribute("state","opened");
        if(x.tagName.toLowerCase() == "closedfold")
            x.setAttribute("state","closed");

        x.querySelector("header").addEventListener("click",e=>{
            let fold = e.target.parentNode;
            if(fold.getAttribute("state")=="closed"){
                fold.setAttribute("state","opened");
                fold.querySelector("content").classList.add("-opened");
            }else{
                fold.setAttribute("state","closed");
                fold.querySelector("content").classList.remove("-opened");
            }
        });
        if(x.getAttribute("state")=="opened")
            x.querySelector("content").classList.add("-opened");
    });

    // annotations
    let annotations = [];
    ml.querySelectorAll("note").forEach(x => {
        annotations.push(x.innerHTML);
        x.innerHTML = annotations.length;
    });
    if(annotations.length > 0){
        let wrapper = document.createElement("annotations");
        annotations.forEach((x,i) => {
            let ann = document.createElement("notedesc");
            let num = document.createElement("number");
            let des = document.createElement("text");
            num.innerText = i+1;
            des.innerHTML = x;
            ann.append(num);
            ann.append(des);
            wrapper.appendChild(ann);
        });
        ml.appendChild(wrapper);
    }

    //tables
    ["clear","zebra","static-zebra"].forEach(cls=>{
        Array.from(ml.querySelectorAll(cls + "-table")).reverse().forEach(x=>{
            let nt = document.createElement("table");
            nt.classList.add(cls);
            let tml = x.innerHTML;
            tml = tml
                .replace(/<row/gi, "<tr")
                .replace(/<hcol/gi, "<th")
                .replace(/<dcol/gi, "<td")
                .replace(/<\/row/gi, "</tr")
                .replace(/<\/hcol/gi, "</th")
                .replace(/<\/dcol/gi, "</td");
            nt.innerHTML = tml;
            x.parentNode.insertBefore(nt, x.nextSibling);
            x.remove();
        });
    });

    //sourcecode
    let sourcetags = "src-javascript,src-csharp,src-json,src-xml";
    ml.querySelectorAll(sourcetags).forEach(x => {
        let tn = x.tagName.toLowerCase();
        let tne = tn.split("-");

        let pre = document.createElement("pre");
        let code = document.createElement("code");
        code.classList.add("language-"+tne[1]);
        code.innerHTML = x.innerHTML;
        pre.append(code);
        x.parentNode.insertBefore(pre, x.nextSibling);
        x.remove();
    });
    Prism.highlightAll();

    // pagelink
    ml.querySelectorAll("pagelink").forEach(x => {
        x.addEventListener("click",e=>{
            loadPage(e.target.getAttribute("page"));
        });
    });

    // powered by
    let v = document.createElement("genversion");
    let vi = document.createElement("div");
    let rs = document.createElement("div");
    let cp = document.createElement("div");
    rs.classList.add("-reload");
    vi.innerText = `powered by docsy v${window.docsy.version.toString()}`;
    rs.innerText = "reload";
    cp.innerText = docsy.current.page;
    v.append(vi);
    if(docsy.current.debugging)
        v.append(cp);
    v.append(rs); ml.append(v);
    rs.addEventListener("click",loadPage.bind(null,docsy.current.page));

    // anchor target
    ml.querySelectorAll("a").forEach(x=>x.target = "_blank");

    // patternmatch
    ml.querySelectorAll("*").forEach(x => {
        if(x.tagName.toLowerCase().indexOf("icon-") == 0){
            let i = document.createElement("i");
            i.classList.add("fas");
            i.classList.add(`fa-${x.tagName.toLowerCase().replace("icon-","")}`);
            x.appendChild(i);
        }
    });

    //color
    ml.querySelectorAll("color").forEach(x => {
        let hex = x.getAttribute("hex");
        hex = hex.replace("#","");
        hex = `#${hex}`;
        x.style.color = hex;
    });
}

function init() {
    window.ix = document.querySelector("#index");
    window.ps = document.querySelector("#pagestage")
    getAsync("/descriptor.json", x => loadDescriptor(JSON.parse(x)));
}

init();