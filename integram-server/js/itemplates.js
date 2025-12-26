function iGetTemplate(path,rep,name,fd){
    if($('head script[src="/js/jszip.min.js"]').length===0){
        var ele = document.createElement('script');
        ele.setAttribute("type", "text/javascript");
        ele.setAttribute("src", '/js/jszip.min.js');
        $('head').append(ele);
        ele.setAttribute("src", '/js/FileSaver.min.js');
        $('head').append(ele);
    }
    fetch(path)
         .then(response => response.blob())
         .then(content => {newApi('POST','report/'+rep+'?JSON_KV','iGetTemplateDone',fd||'',{path:path,name:name,content:content});})
       .catch(error => { console.error('Error:', error); });
}
function iGetTemplateDone(json,vars) {
    var reader = new FileReader();
    reader.onload = function (e) {
        var i,j,data = new Uint8Array(e.target.result)  // из word
            ,zip = new JSZip();
        zip.loadAsync(data)
            .then(function(zip){
                // в архиве найти файл word/document.xml
                zip.file("word/document.xml").async("string").then(function(xmlfile){
                    //console.log(xmlfile);
                    let newxml=isprXML(xmlfile);
                    for(i in json)
                        for(j in json[i])
                            newxml = newxml.replaceAll('{'+j+(i>0?i:'')+'}',json[i][j]);
                    for(j in json[0])
                        newxml = newxml.replace(new RegExp('\\{'+j+'\\d*?\\}','gmu'),'');
                    zip.file("word/document.xml", newxml);
			        var promise = null;
                    if(JSZip.support.uint8array)
                        promise = zip.generateAsync({ type: "uint8array" });
                    //zip2.file(my_json.File+'.docx', promise);
                    zip.generateAsync({ type: "blob" })
					.then(function (blob) {
						saveAs(blob, vars.name||'out.docx');
					});
                });
            });
    };
    reader.readAsArrayBuffer(vars.content);       
}
function isprXML(xmlfile) {
    // почистить шаблон до правильного вида переменных 
    var re = new RegExp('({'+'.*?})','sg');
    var re2 = /(<.*?>)/g;
    let result = xmlfile.match(re) || [];
    let newres = [];
    result.forEach(element => {
                var newel = element.replace(re2, "");
                xmlfile = xmlfile.replace(element, newel);
            });
     return xmlfile;
}
