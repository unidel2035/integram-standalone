// import js from '../../custom/js';
// import ig from "../integram";
// import user from '../user-data';

var modules = {};
if ( typeof user == 'object'
    && typeof ig == 'object'
    && typeof js == 'object') modules = {js, ig, user};

var byId     = modules.js?.byId     || window.byId;
var newApi_  = modules.ig?.newApi   || window.newApi;
var search   = modules.js?.search   || window.search;
var t9n      = modules.js?.t9n      || window.t9n;
var db       = modules.user?.dbName || window.db;
var dbhost   = modules.user?.host   || '';
var dborigin = dbhost ? 'https://'+dbhost : '';

const smQ   = [];

class SmartQ { 
    constructor(tableId, reportId) {
        this.tbId = tableId;
        this.id = reportId;
        this.selId = `#SQT-${tableId} `; 
        
        this.msLink=`<span class="badge badge-pill badge-secondary-outline border border-secondary p-1 ml-1 mt-1 mb-0 mr-0">
            :text:
            <a class="ms-link drop-ms ml-1" onclick="smQ[${this.tbId}].dropRef(this,\':text:\')">
                ${svgStore.dropButton}
            </a></span>`;
        this.addTableReq=`<a class="new-table-req position-absolute :base:" 
                             onclick="smQ[${this.tbId}].addRow(this)">
                ${svgStore.addButton}
            </a>`;
        this.dubRecBtn=`<a class="new-table-req position-absolute :base:" 
                           onmouseover="smQ[${this.tbId}].markGroup(this)" 
                           onmouseout="smQ[${this.tbId}].unMarkGroup()" 
                           onclick="smQ[${this.tbId}].dubRec(this)" 
                           title=" ${t9n('[RU]Дублировать эту строку[EN]Duplicate the line')}">
                ${svgStore.dubButton}
            </a>`;
        this.delFile=`<a class="mr-3" onclick="smQ[${this.tbId}].deleteFile(this)">
                ${svgStore.delButton}
            </a>`;
            
        this.bt = { 
             3: 'SHORT',
             8: 'CHARS',
             9: 'DATE',
            13: 'NUMBER',
            14: 'SIGNED',
            11: 'BOOLEAN',
            12: 'MEMO',
             4: 'DATETIME',
            10: 'FILE',
             2: 'HTML',
             7: 'BUTTON',
             6: 'PWD',
             5: 'GRANT',
            15: 'CALCULATABLE',
            16: 'REPORT_COLUMN',
            17: 'PATH'
        };
        
        this.order    = 0;
        this.page     = 1;
        this.total    = undefined;
        this.totalsOn = undefined;
        this.columns  = {};
        this.ids      = {};
        this.arrs     = {};
        this.metas    = {};
        this.uniq     = {};
        this.lastHead = undefined
        this.baseType = new Array();
        
        this.ddList       = {};
        this.ddLLimit     = 50;
        this.limit        = undefined;
        this.defaultLimit = 20;
        this.timer        = undefined;
        this.lastK        = undefined;
    }
    init(target){
        var zis=this;
        target.innerHTML = '';
        target.appendChild(this.render());
        if (this.id>0) newApi_('GET','edit_obj/'+this.id+'?JSON',this.getSmart,'',this);
            else $('.rep-header').html( 
                t9n('[RU]Не задан [EN]Choose ')
                + `<a href="/${db}/sql">` + t9n('[RU]запрос[EN]a query') + '</a>'
            );       
    }
    renderErrorMessageBlock() {
        var div = document.createElement('div');
        div.innerHTML = 
           `<div class="err-msg card bg-warning position-absolute mt-5 p-3" 
                onclick="$(this).hide()" style="display: none;"></div>`;
        return div;
    }
    renderSubTotalsTab() {
        var div = document.createElement('div');
        div.classList.add('sub-totals-tab','bg-light','border','shadow',
                            'position-absolute','mt-3','ml-3','mr-3','p-3');
        div.style.display = 'none';
        div.innerHTML = 
           `<nobr><span>SUM:   </span> <span class="sub-totals-sum">   0 </span>, </nobr> &nbsp; 
            <nobr><span>COUNT: </span> <span class="sub-totals-count"> 0 </span>, </nobr> &nbsp; 
            <nobr><span>AVG:   </span> <span class="sub-totals-avg">   0 </span>, </nobr> &nbsp; 
            <nobr><span>MIN:   </span> <span class="sub-totals-min">   0 </span>, </nobr> &nbsp; 
            <nobr><span>MAX:   </span> <span class="sub-totals-max">   0 </span>  </nobr> &nbsp; 
            <a onclick="smQ[${this.tbId}].clearSubTotals()">
                ${svgStore.clearButton}
            </a>
            <a onclick="$('.sub-totals-tab').toggleClass('right-totals')">
                ${svgStore.triangularBracketsButton}
            </a>`;
        return div;
    }
    renderAddRowBtn() {
        var btn = document.createElement('div');
        btn.innerHTML = 
            `<a class="new-req pt-1" onclick="smQ[${this.tbId}].addRow()" style="display:none">
                ${svgStore.addRowBigButton}
            </a>`;   
        return btn;
    }
    renderSqHeader() {
        var header = document.createElement('center');
        header.innerHTML = 
           `<h3>
                <span class="ajax-wait" style="display:none"><img src="/i/ajax.gif"></span>&nbsp;<span class="rep-header"></span>
                <a href="/${db}/smartq/${this.id}" class="ml-2 clear-filters" style="display: none;">
                    ${svgStore.resetFiltersLens}
                </a>
                <a onclick="$('.refr').toggle();smQ[0].doApplyFilters()"> ${svgStore.refreshButton} </a>
                <a href="/${db}/sql/${this.id}"> ${svgStore.configButton} </a>
            </h3>`
        return header;
    }
    renderSqTable() {
        var table = document.createElement('table');
        table.classList.add('sq-table','table','table-sm','table-bordered');
        table.innerHTML = `<thead><tr class="tr-sticky"><tbody>`;
        return table;
    }
    renderPagination() {
        var pagination = document.createElement('table');
        pagination.classList.add('pl-3');
        pagination.innerHTML = 
            `<tr>
            <td class="switch-pages">
                <a id="pageFirst" class="page-switch" onclick="smQ[${this.tbId}].doApplyFilters(-2)" style="display:none">
                    ${svgStore.firstPageButton}
                </a>
            <td class="switch-pages">
                <a id="pagePrev" class="page-switch" onclick="smQ[${this.tbId}].doApplyFilters(-1)" style="display:none">
                    ${svgStore.prevPageButton}
                </a>
            <td> 
                <span class="page-count-from"></span>
                <span class="page-count-to"></span>
                <span class="page-count-recs"></span>
                <span class="total-count total-count-from"></span>
                <span class="total-count total-count-num"></span>
            <td class="switch-pages">
                <a id="pageNext" class="page-switch" onclick="smQ[${this.tbId}].doApplyFilters(1)" style="display:none">
                    ${svgStore.nextPageButton}
                </a>
            <td class="switch-pages">
                <a id="pageLast" class="page-switch" onclick="smQ[${this.tbId}].doApplyFilters(2)" style="display:none">
                    ${svgStore.lastPageButton}
                </a>
            </tr>`;
        return pagination;
    }    
    render() {
        const el = document.createElement('div');
        el.id = `SQT-${this.tbId}`;
        el.classList.add('sq-blocks');
        el.appendChild(this.renderErrorMessageBlock());
        el.appendChild(this.renderSubTotalsTab());
        el.appendChild(this.renderAddRowBtn());
        el.appendChild(this.renderSqHeader());
        el.appendChild(this.renderSqTable());
        return el;         
    }
    
    /* Native smartQ functions: */
    unMarkGroup(){
        var zis=this;
        $(zis.selId+'.dub-grouped').removeClass('dub-grouped');
    }
    markGroup(el){
        const oid=$(el).closest('td').attr('obj-id');
        $('td[obj-id='+oid+']').closest('tr').addClass('dub-grouped');
    }
    errMsgCard(err){
        var zis=this;        
        $(zis.selId+'.err-msg').html(err).show();
        setTimeout(()=>{$('.err-msg').hide()},9000);
    }
    getRep(json,zis=this){
        if (!zis) zis=smQ[0];
        zis.clearSubTotals();
        $(zis.selId+'.ajax-wait').hide();
        var i,j,h,name,type,filters,base,value,curHead='';
        for(i in json.columns) // Remember the columns set
            curHead+=json.columns[i].name+i;
        if(zis.lastHead!==curHead){ // No table header yet or columns added/removed
            zis.columns = zis.ids = zis.arrs = zis.metas = {};
            zis.lastHead=curHead;
            for(i in json.columns)
                zis.columns[json.columns[i].name]={type:json.columns[i].type,col:i};
            h='';
            filters='<tr class="no-padding filters">';
            for(i in json.columns)
                if(json.columns[i].id){
                    name=json.columns[i].name;
                    type=json.columns[i].type;
                    if(name.substr(-2)==='ID' && zis.columns[name.substr(0,name.length-2)]){
                        zis.ids[i]=0;
                        $(zis.selId+'.new-req').show();
                        if(!zis.metas[type]&&!json.columns[i].ref){
                            newApi_('GET','metadata/'+type,zis.getMeta,'',undefined,zis);
                            zis.metas[type]=0;
                        }
                    }
                    else{
                        if(zis.columns[name+'ID'])
                            zis.ids[i]=1;
                        h+='<th id="'+type+'"'+(zis.ids[i]?' is-object="1"':'')+'><a sq-order desc col-id="'+json.columns[i].id+'" onclick="smQ['+zis.tbId+'].orderBy(this)">'
                            +'<span class="sq-order-num"></span><span class="sq-order-dir"></span> <span class="sq-col-name">'+name+'</span></a>'
                            +'<span class="resize-handle" onMouseDown="smQ['+zis.tbId+'].columnResize(this)"></span>';
                        filters+='<td><input filter-id="'+type+'" base="'+json.columns[i].format+'" name="FR_'+name.replace(/ /g,'_')+'" placeholder="'+t9n('[RU]Поиск[EN]Search')+'">';
                    }
                }
            $(zis.selId+'.sq-table thead tr').html(h);
            $(zis.selId+'.sq-table tbody').html(filters);
            $(zis.selId+'.filters input').keyup(()=>{zis.applyFilters(event.target)});
            const urlParams = zis.getFilterParams(); 
            if(!$.isEmptyObject(urlParams)){
                $(zis.selId+'.clear-filters').show();
                $(zis.selId+'.refr').removeClass('ml-2');
            }
            for(let key in urlParams)
                $(zis.selId+'.filters input[name="'+key+'"]').val(urlParams[key]);
            i=-1;
            $(zis.selId+'.sq-table').click(function(){ if(event.target.tagName==='TD'&&event.ctrlKey) zis.processSubTotals(event.target) });
        }
        else if(json.data[0].length===0){
            if(zis.page===1){
                $(zis.selId+'.page-switch,.total-count').hide();
                $(zis.selId+'.page-count-from').html('');
                $(zis.selId+'.page-count-to').html('0 ');
                $(zis.selId+'.page-count-recs').html(t9n('[RU]записей[EN]records'));
                $(zis.selId+'.sq-row').remove();
            }
            else{
                $(zis.selId+'#pageNext,#pageLast').hide();
                $(zis.selId+'.total-count').html('');
                zis.total=zis.page*zis.limit-zis.limit;
                zis.page--;
            }
            zis.drawFoot(json);
            return;
        }
        else
            $(zis.selId+'.sq-row').remove();
        h='';
        for(i in json.data[0])
            h+=zis.drawLine(json,i);
        $(zis.selId+'.sq-table tbody').append(h);
        $(zis.selId+'.sq-row td[req-id]').click(function(){zis.inlineEdit(this)});
        if('totals' in json.columns[0])
            zis.totalsOn=true;
        zis.drawFoot(json);
        i++;
        if(i<zis.defaultLimit){
            zis.total=zis.limit*zis.page-zis.limit+i;
            $(zis.selId+'.total-count').hide();
        }
        if(i<zis.defaultLimit&&zis.page===1){
            $(zis.selId+'.page-count-from').html(t9n('[RU]Всего [EN]Total: '));
            $(zis.selId+'.page-count-to').html(i);
            $(zis.selId+'.page-count-recs').html('');
        }
        else{
            $(zis.selId+'.page-count-from').html((zis.page*zis.limit-zis.limit+1)+'-');
            $(zis.selId+'.page-count-to').html(zis.page*zis.limit-zis.limit+i);
            $(zis.selId+'.page-count-recs').html('');
            $(zis.selId+'.total-count-from').html(t9n('[RU] из [EN] of ')).show();
            $(zis.selId+'.total-count-num').html(zis.total?zis.total:'<a onclick="smQ['+zis.tbId+'].getCount()">?</a>').show();
        }
        if(i<zis.defaultLimit)
            $(zis.selId+'#pageNext,#pageLast').hide();
        else{
            if(!zis.total||zis.total!=zis.page*zis.limit-zis.limit+i)
                $(zis.selId+'#pageNext').show();
            else
                $(zis.selId+'#pageNext').hide();
            if(zis.total&&zis.total!=zis.page*zis.limit-zis.limit+i)
                $(zis.selId+'#pageLast').show();
            else
                $(zis.selId+'#pageLast').hide();
        }
        $('.sq-row').find('td[base="MEMO"]').each(function(){ // restore the line breaks
            zis.addBreaks(this);
        });
        if(zis.page===1)
            $(zis.selId+'#pagePrev,#pageFirst').hide();
        else
            $(zis.selId+'#pagePrev').show();
        if(zis.page>2)
            $(zis.selId+'#pageFirst').show();
        $(zis.selId+'.sq-row').find('td').each(function(){zis.markDown(this)});
        zis.postProcessHead();
    }
    postProcessHead(){
        var i,dropCol={},zis=this;
        if (!zis) zis=smQ[0];   
        $(zis.selId+'.sq-table th').each(function(i){
            var name=$(this).find('.sq-col-name').html();
            $(zis.selId+'.sq-row td').each(function(){
                if($(this).html().indexOf('['+name+']')!==-1){
                    if($(this).closest('.sq-row').find('td')[i].innerHTML.length>0)
                        $(this).html($(this).html().replace('['+name+']',$(this).closest('.sq-row').find('td')[i].innerHTML));
                    dropCol[i]=i;
                }
            });
        });
        for(i in dropCol){
            $($(zis.selId+'.sq-table th')[i]).hide();
            $($(zis.selId+'.filters td')[i]).hide();
            $(zis.selId+'.sq-row').each(function(){
                $(this).find('td').each(function(index){
                    if(i==index)
                        $(this).hide();
                });
            });
        }
    }
    addBreaks(el){
        $(el).attr('old-val',$(el).html());
        $(el).html($(el).html().replace(/[\t\ n]+$/gm,'').replace(/\n/gm,'<br />'));
    }
    drawFoot(json,el,zis=this){
        if (!zis) zis=smQ[0];        
        $(zis.selId+'.sq-table tfoot').remove(); // Re-create the footer if any
        if('totals' in json.columns[0]){
            var j,h='<tfoot><tr>';
            for(j in json.columns)
                if(zis.ids[j]!==0)
                    h+='<th footer-id="'+json.columns[j].type+'" align="right">'+(json.columns[j].totals||'');
            $(zis.selId+'.sq-table').append(h);
        }
    }
    drawLine(json,i,cl){
        var base,j,h='<tr class="sq-row '+(cl||'')+'">';
        for(j in json.data){
            const col=json.columns[j];
            base='base="'+col.format+'"';
            var value = this.isNumeric(col.format) ? this.formatNum(json.data[j][i],col.format) : value=json.data[j][i];
            if(col.type==='')
                h+='<td '+base+' class="calculable">'+value;
            else if(this.ids[j]===1)
                h+='<td req-id="'+col.type+'" is-object="1" class="position-relative" '+base
                    +' onmouseover="smQ['+this.tbId+'].showAdd('+col.type+',this)"'
                    +(col.ref?' ref-id="':' obj-id="')+json.data[this.columns[col.name+'ID'].col][i]+'">'+value;
            else if(this.ids[j]!==0)
                h+='<td req-id="'+col.type+'" class="position-relative" '+base
                    +'onmouseover="'+(col.ref?'smQ['+this.tbId+'].showAdd('+col.type+',this)':'$(\'.new-table-req\').remove()')+'">'+value;
        }
        return h;
    }
    orderSync(o){
        var zis=this;
        $(zis.selId+'.sq-table th a').each(function(){
            const i=parseInt($(this).attr('sq-order'));
            if(i>o){
                $(this).attr('sq-order',i-1);
                $(this).find('.sq-order-num').html(i-1);
            }
        });
    }
    orderBy(el){
        var zis = this || smQ[0];
        if($(el).attr('sq-order')===''){
            $(el).attr('sq-order',++zis.order).attr('desc','');
            $(el).find('.sq-order-num').html(zis.order);
            $(el).find('.sq-order-dir').html('&#9651;');
        }
        else if($(el).attr('desc')===''){
            $(el).attr('desc',1);
            $(el).find('.sq-order-dir').html('&#9661;');
        }
        else{
            zis.orderSync(parseInt($(el).attr('sq-order')));
            $(el).attr('sq-order','');
            $(el).find('.sq-order-num,.sq-order-dir').html('');
            zis.order--;
        }
        zis.doApplyFilters();
    }
    isNumeric(v){
        return ['NUMBER','SIGNED'].includes(v);
    }
    showAdd(rid,el){ 
        var zis = this || smQ[0];
        if($(el).find('.new-table-req').length>0||$(el).hasClass('editing')||$(el).html().length==0)
            return;
        $(zis.selId+'.new-table-req').remove();
        if(typeof this.metas[rid]==='object'&&!this.metas[rid].refId)
            return;
        const align=this.isNumeric($(el).attr('base'))?'NUMBER':'NO-NUMBER';
        var isRef, parentId;
        if(this.metas[rid]===0)
            return $(el).prepend(zis.dubRecBtn.replace(':base:',align));
        if(typeof this.metas[rid]==='object'){ // This is a reference
            rid=this.metas[rid].id; // Get its parent
            isRef=true;
        } else parentId = $(el).closest('.sq-row').find('td[req-id='+this.metas[rid]+'][is-object=1]').attr('obj-id')
                       || $(el).closest('.sq-row').find('td[req-id='+this.metas[rid]+'][is-object=1]').attr('ref-id');
        if(parentId>0&&($(el).attr('obj-id')>0||isRef))
            $(el).prepend(zis.addTableReq.replace(':base:',align));
    }
    dubRec(el){ // Duplicate the main record
        const td=$(el).closest('td');
        const tid=td.attr('req-id');
        const oid=td.attr('obj-id');
        const base=td.attr('base');
        if(this.uniq[tid]==='1'){
            $(el).remove();
            var val=td.html();
            if(base==="NUMBER")
                newApi_('POST','object/'+tid+'?JSON&order_val=val&desc=1&LIMIT=1',this.dubRecUniqNum,'',{td:td,oid:oid,tid:tid,val:val},this);
            else if(base==="SHORT"||base==="CHARS"){ 
                var fd=new FormData();
                var index=val.match(/ \((\d+)\)$/);
                if(index){
                    index=parseInt(index[1])+1
                    val=val.replace(/( \(\d+\)$)/,'');
                }
                else
                    index=1;
                fd.append('F_'+tid,val+' ('+index+')');
                newApi_('POST','object/'+tid+'?JSON',this.dubRecUniqText,fd,{td:td,oid:oid,tid:tid,val:val,index:index},this);
            }
            else if(base==="DATETIME") // Set current date&time and hope this is unique so far
                newApi_('POST','_m_save/'+oid+'?JSON&t'+tid+'='+(Date.now()/1000),this.dubRecDone,'copybtn=1',td,this);
            else
                this.errMsgCard(t9n('[RU]Значение типа '+base+' уникально и не может быть продублировано[EN]Please duplicate the unique value of '+base+' another way'));
        }
        else
            newApi_('POST','_m_save/'+oid+'?JSON',this.dubRecDone,'copybtn=1',td,this);
        event.stopPropagation();
    }
    dubRecUniqText(json,vars,zis=this){ // Check for duplicates for uniques
        if (!zis) zis=smQ[0];        
        var fd=new FormData();
        if(json.object){
            vars.index++;
            fd.append('F_'+vars.tid,vars.val+' ('+vars.index+')');
            newApi_('POST','object/'+vars.tid+'?JSON',zis.dubRecUniqText,fd,{td:vars.td,oid:vars.oid,tid:vars.tid,val:vars.val,index:vars.index},zis);
        }
        else{
            fd.append('t'+vars.tid,vars.val+' ('+vars.index+')');
            fd.append('copybtn',1);
            newApi_('POST','_m_save/'+vars.oid+'?JSON',zis.dubRecDone,fd,vars.td,zis);
        }
    }
    dubRecUniqNum(json,vars,zis=this){ // Check for duplicates for uniques
        if (!zis) zis=smQ[0];        
        if(json.object&&json.object[0].val&&parseInt(json.object[0].val))
            newApi_('POST','_m_save/'+vars.oid+'?JSON&t'+vars.tid+'='+(parseInt(json.object[0].val)+1),zis.dubRecDone,'copybtn=1',vars.td,zis);
        else
            zis.errMsgCard(t9n('[RU]Ошибка вычисления уникального значения[EN]Failed to calculate the unique value'));
    }
    dubRecDone(json,el,zis=this){ // Duplicate done - get it via report
        if (!zis) zis=smQ[0];        
        var fd=new FormData();
        fd.append('FR_'+$('#'+$(el).attr('req-id')).find('.sq-col-name').html()+'ID',json.obj);
        newApi_('POST','report/'+zis.id+'?JSON',zis.newRecGet,fd,{el:el},zis);
    }
    newRecGet(json,vars,zis=this){ // Show the duplicate
        if (!zis) zis=smQ[0];        
        $(zis.selId+'.dub-rec').removeClass('dub-rec');
        for(var i in json.data[0]){
            $(vars.el).closest('tr').before(zis.drawLine(json,i,'dub-rec'));
            $(vars.el).closest('tr').prev().find('td[base="MEMO"]').each(function(){ // restore the line breaks
                zis.addBreaks(this);
                zis.markDown(this);
            });
        }
        if(vars.mode && vars.el.attributes){ 
            // Restore the subtotals class
            $(zis.selId+'td[obj-id='+$(vars.el).attr('obj-id')+']').closest('tr:not(.dub-rec)').find('td').each(function(i){
                if($(this).hasClass('sub-totals'))
                    $('td[obj-id='+$(vars.el).attr('obj-id')+']').closest('.dub-rec').find('td').eq(i).addClass('sub-totals');
            });
            $(zis.selId+'td[obj-id='+$(vars.el).attr('obj-id')+']').closest('tr:not(.dub-rec)').remove();
        }
        $(zis.selId+'.dub-rec td[req-id]').click(function(){zis.inlineEdit(this)});
        if(vars.mode==='edit')
            $(zis.selId+'.dub-rec').removeClass('dub-rec');
        else{
            if(!vars.mode && vars.el.attributes)
                $(zis.selId+'.dub-rec td[req-id='+$(vars.el).attr('req-id')+']').first().click();
            setTimeout(()=>{$(zis.selId+'.dub-rec').removeClass('dub-rec')},3000);
        }
        if($(zis.selId+'.sub-totals').length>0) zis.recalcSubTotals();
        zis.doApplyFilters('TOTALS');
        zis.postProcessHead();
    }
    addRow(el){
        var zis = this || smQ[0];
        event.stopPropagation();
        if($(zis.selId+'.sq-new').length>0)
            return $(zis.selId+'.sq-new').click();
        var i,j,reqId,td,h='';
        if(el)
            reqId=$(el).closest('td').attr('req-id');
        $(zis.selId+'.sq-table thead tr th').each(function(){
            var i;
            if(el&&(zis.metas[this.id]===0))
                i=$(el).closest('.sq-row').find('td[req-id='+this.id+']').attr('obj-id');
            h+='<td req-id="'+this.id+'" '+(zis.baseType[this.id]?'base="'+zis.baseType[this.id]+'"':'')+' onclick="smQ['+zis.tbId+'].inlineEdit(this)"'
                    +' class="position-relative '+(reqId===this.id||(!reqId&&zis.metas[this.id]===0)?' sq-new':'')+(this.id?'':' calculable')+'"'
                    +(this.id?' onmouseover="smQ['+zis.tbId+'].showAdd('+this.id+',this)"':'')
                    +($(this).attr('is-object')?' is-object="1"':'')+'>';
        });
        if(reqId){
            $(el).closest('.sq-row').after('<tr class="sq-row" id="newRow">'+h);
            $(zis.selId+'#newRow').find('td').each(function(){ // Fill in the upper fields
                const i=$(this).attr('req-id');
                if(zis.metas[reqId].id===i)
                    $(this).html('');
                else if(i&&reqId!==i)
                    if(!zis.isUnder(reqId,i)){
                        const td=$(el).closest('.sq-row').find('td[req-id='+i+']');
                        $(this).html(td.html());
                        if($(td).attr('obj-id'))
                            $(this).attr('obj-id',$(td).attr('obj-id'))
                        if($(td).attr('ref-id'))
                            $(this).attr('ref-id',$(td).attr('ref-id'))
                    }
            });
            $(zis.selId+'#newRow').removeAttr('id');
            $(el).remove();
        }
        else
            $(zis.selId+'.sq-table .filters').after('<tr class="sq-row">'+h);
        $(zis.selId+'.sq-new').click();
    }
    isUnder(reqId,i){
        while(i)
            if(i===reqId||this.metas[i].id===reqId)
                return true;
            else
                i=this.metas[i].id||this.metas[i];
    }
    navKey(el){
        var neigh;
        if(event.keyCode===13&&!event.shiftKey){ // Enter
            $(el).closest('td').removeClass('last-edited');
            this.saveVal(el);
        }
        else if(event.keyCode===27){ // Escape
            el.value=$(el).closest('td').attr('old-val');
            $(el).closest('td').removeClass('last-edited');
            this.saveVal(el);
        }
        else if(event.keyCode===38&&$(el).prop("tagName")!=='MEMO'){ // Up arrow
            if(neigh=$(el).closest('tr').prev().find('td')[$(el).closest('td').prevAll('td').length])
                neigh.click();
        }
        else if(event.keyCode===40&&$(el).prop("tagName")!=='MEMO'){ // Down arrow
            if(neigh=$(el).closest('tr').next().find('td')[$(el).closest('td').prevAll('td').length])
                neigh.click();
        }
        else if(event.keyCode===9){ // Tab
            if(event.shiftKey)
                $(el).closest('td').prev().click();
            else
                $(el).closest('td').next().click();
            event.preventDefault();
        }
    }
    clearSubTotals(){
        var zis=this;
        $(zis.selId+'.sub-totals').removeClass('sub-totals sub-totals-left sub-totals-right sub-totals-top sub-totals-bottom');
        $(zis.selId+'.sub-totals-tab').hide();
    }
    processSubTotals(el){
        if($(el).hasClass('sub-totals'))
            $(el).removeClass('sub-totals-left sub-totals-right sub-totals-top sub-totals-bottom');
        $(el).toggleClass('sub-totals');
        this.recalcSubTotals();
    }
    recalcSubTotals(){
        var val;
        var zis = this || smQ[0];        
        var sum=count=avg=min=max=0;
        $(zis.selId+'.sub-totals').each(function(){
            const base=$(this).attr('base');
            if(base==='NUMBER')
                val=parseInt(zis.unFormatNum($(this).html()))||0;
            else
                val=parseFloat(zis.unFormatNum($(this).html()))||0;
            sum+=val;
            count++;
            if(min>val)
                min=val;
            if(max<val)
                max=val;
            // Recalc borders
            if($(this).prev().hasClass('sub-totals'))
                $(this).prev().removeClass('sub-totals-right');
            else
                $(this).addClass('sub-totals-left');
            if($(this).next().hasClass('sub-totals'))
                $(this).next().removeClass('sub-totals-left');
            else
                $(this).addClass('sub-totals-right');
            const i=$(this).closest('tr').find('td').index(this);
            if($(this).closest('tr').prev().find('td').eq(i).hasClass('sub-totals'))
                $(this).closest('tr').prev().find('td').eq(i).removeClass('sub-totals-bottom');
            else
                $(this).addClass('sub-totals-top');
            if($(this).closest('tr').next().find('td').eq(i).hasClass('sub-totals'))
                $(this).closest('tr').next().find('td').eq(i).removeClass('sub-totals-top');
            else
                $(this).addClass('sub-totals-bottom');
        });
        $(zis.selId+'.sub-totals-sum').html(sum);
        $(zis.selId+'.sub-totals-count').html(count);
        $(zis.selId+'.sub-totals-min').html(min);
        $(zis.selId+'.sub-totals-max').html(max);
        $(zis.selId+'.sub-totals-avg').html((sum/count).toFixed(2).replace('.00',''));
        $(zis.selId+'.sub-totals-tab').show();
    }
    inlineEdit(el){
        var zis = this || smQ[0];        
        event.stopPropagation();
        if(event&&event.ctrlKey)
            return this.processSubTotals(el);
        var reqType=$(el).attr('req-id')
            ,w=$(el).css('width');
        if($(zis.selId+'#'+reqType).css('max-width')==='none')
            $(zis.selId+'#'+reqType+',td[req-id='+reqType+']').css('max-width',w).css('min-width',w);
        if($(el).hasClass('editing')&&event.target&&event.target.tagName==='TD'&&zis.metas[reqType].refId)
            return this.blurSelect($(el).find('select'));
        if($(el).hasClass('editing')||$(el).hasClass('saving')||!$(el).attr('req-id'))
            return;
        if($(el).hasClass('last-edited'))
            return $(el).removeClass('last-edited');
        if($(el).attr('base')!=='FILE' && ($(el).html().indexOf('<a target')!==-1||zis.metas[reqType]===undefined)) // Interactive report or unknown rec type
            return;
        $(zis.selId+'.editing[base=FILE]').find('input').each(function(){zis.saveInlineFile(this)});
        // For a requisite, check if the parent ID is known
        if(typeof this.metas[reqType]==='object'&&!$(el).closest('.sq-row').find('td[req-id='+zis.metas[reqType].id+']').attr('is-object'))
            return;
        $(zis.selId+'.new-table-req,input[type="file"]').remove();
        var i,isNew,val=$(el).html()
            ,parentType=parseInt(this.metas[reqType].id||this.metas[reqType]);
        const parentId=$(el).closest('.sq-row').find('td[req-id='+parentType+'][is-object=1]').attr('obj-id')
                    ||$(el).closest('.sq-row').find('td[req-id='+parentType+'][is-object=1]').attr('ref-id');
        $(zis.selId+'.select2.inline-edit').each(function(){zis.blurSelect(this)});
        if(!val) isNew=true;
        if(this.metas[reqType].ref){
            if(this.metas[reqType].multi){
                var h='',mult=val.split(',');
                for(i in mult)
                    if(mult[i].length>0)
                        h+=this.msLink.replace(/:text:/g,this.escapeHtmls(mult[i]));
                $(el).html(h);
                $(el).append('<select multi="1" ref-id="'+reqType+'" class="select2 inline-edit ml-1 mt-1 w-100" onchange="smQ['+zis.tbId+'].saveRef(this)"><option> </option></select>');
                this.fillInDdl(el,mult);
            }
            else{
                $(el).html('<select ref-id="'+reqType+'" class="select2 inline-edit w-100" onchange="smQ['+zis.tbId+'].saveRef(this)">'
                                +'<option selected value="current">'+val+'</option></select>');
                this.fillInDdl(el,[val]);
            }
        }
        else if($(el).attr('base')==='MEMO')
            $(el).html('<textarea class="inline-edit w-100" onkeydown="smQ['+zis.tbId+'].navKey(this)" onblur="smQ['+zis.tbId+'].saveVal(this)" onchange="smQ['+zis.tbId+'].saveVal(this)" style="min-height:'+$(el).css('height')+';max-height:'+$(el).css('height')+'">');
        else if($(el).attr('base')==='DATE'){
            $(el).html('<input type="date" class="inline-edit w-100" onkeydown="smQ['+zis.tbId+'].navKey(this)" onblur="smQ['+zis.tbId+'].saveVal(this)" onfocusout="smQ['+zis.tbId+'].saveVal(this)">');
            val=moment.utc(val||new Date(),'DD.MM.YYYY');
        }
        else if($(el).attr('base')==='DATETIME'){
            $(el).html('<input type="datetime-local" class="inline-edit w-100" onkeydown="smQ['+zis.tbId+'].navKey(this)" onblur="smQ['+zis.tbId+'].saveVal(this)" onfocusout="smQ['+zis.tbId+'].saveVal(this)">');
            val=moment.utc(val||new Date(),'DD.MM.YYYY HH:mm:ss');
        }
        else if($(el).attr('base')==='FILE'){
            $(el).attr('old-val',$(el).html());
            $(el).html(($(el).find('a').length>0?zis.delFile:'') + '<input type="file" class="inline-edit" onchange="smQ['+zis.tbId+'].saveInlineFile(this)">');
        }
        else if(zis.isNumeric($(el).attr('base'))){
            val=zis.unFormatNum(val);
            $(el).html('<input type="number" class="inline-edit w-100" onkeydown="smQ['+zis.tbId+'].navKey(this)" onblur="smQ['+zis.tbId+'].saveVal(this)" onchange="smQ['+zis.tbId+'].saveVal(this)">');
        }
        else
            $(el).html('<input type="text" class="inline-edit w-100" onkeydown="smQ['+zis.tbId+'].navKey(this)" onblur="smQ['+zis.tbId+'].saveVal(this)" onchange="smQ['+zis.tbId+'].saveVal(this)">');

        $(zis.selId+'.inline-edit').focus();
        $(zis.selId+'.last-edited,.editing').removeClass('last-edited editing');
        $(zis.selId+'.editing-text').removeClass('editing-text');
        $(el).addClass('editing last-edited');
        $(el).find('input,textarea').closest('td').addClass('editing-text');
        if($(el).attr('obj-id')&&$('td[obj-id='+$(el).attr('obj-id')+']').length>1) // Highlight the same objects in the table in case there are more than one
            if($(el).attr('obj-id'))
                $('td[obj-id='+$(el).attr('obj-id')+']').addClass('same-object');
            else if($(el).attr('ref-id'))
                $('td[ref-id='+$(el).attr('ref-id')+']').each(function(){
                    if(parentId===$(this).closest('.sq-row').find('td[req-id='+parentType+'][is-object=1]').attr('obj-id'))
                        $(this).addClass('same-object');
                });
        if($(el).attr('base')==='DATE'){
            $(el).attr('old-val',isNew?'':val.format("DD.MM.YYYY"));
            $(el).find('input').val(val.format("YYYY-MM-DD"));
        }
        else if($(el).attr('base')==='DATETIME'){
            $(el).attr('old-val',isNew?'':val.format("DD.MM.YYYY"));
            $(el).find('input').val(val.format("YYYY-MM-DD HH:mm:ss"));
        }
        else if($(el).attr('base')==='MEMO')
            $(el).find('textarea').val($(el).attr('old-val'));
        else if($(el).attr('base')!=='FILE'){
            $(el).find('input,textarea').val(val);
            $(el).attr('old-val',val);
        }
    }
    unFormatNum(v){
        return v.replace(/ /g,'').replace(',','.');
    }
    delRefDone(json,el){
        $(el).closest('span').remove();
    }
    getRef(json,vars,zis=this){
        if (!zis) zis=smQ[0];        
        var v;
        if(json.reqs&&json.reqs[vars.id]&&json.reqs[vars.id].multiselect)
            for(var i in json.reqs[vars.id].multiselect.ref_val)
                if(json.reqs[vars.id].multiselect.ref_val[i]===vars.ref){
                    $(vars.el).closest('span').addClass('bg-warning');
                    newApi_('POST','_m_del/'+json.reqs[vars.id].multiselect.id[i]+'?JSON',zis.delRefDone,'',vars.el,zis);
                    if($(vars.el).closest('td').attr('old-val')===vars.ref) // The last and only ref
                        v='';
                    else
                        v=$(vars.el).closest('td').attr('old-val').replace(','+vars.ref+',',',')  // Among others
                                                            .replace(new RegExp(zis.escapeRegex(','+vars.ref)+'$',''),'') // Last
                                                            .replace(new RegExp('^'+zis.escapeRegex(vars.ref+','),''),''); // First
                    $(vars.el).closest('td').attr('old-val',v);
                }
    }
    dropRef(el,ref){
        var reqType=$(el).closest('td').attr('req-id')
            ,parentType=this.metas[reqType].id
            ,i=$(el).closest('.sq-row').find('td[req-id='+parentType+']').attr('obj-id');
        if(i)
            newApi_('GET','edit_obj/'+i+'?JSON',this.getRef,'',{el:el,id:reqType,ref:ref},this)
    }
    blurSelect(el){
        var zis = this || smQ[0]; 
        $(el).closest('td').html($(el).closest('td').attr('old-val')).removeClass('editing').removeClass('last-edited');
        $(zis.selId+'.same-object').removeClass('same-object');
    }
    fillInDdlDo(json,vars,zis=this){
        if (!zis) zis=smQ[0];        
        if(json){
            var i,ref=$(vars.el).find('select').attr('ref-id'); 
            const oid=zis.findParent(vars.el,zis);
            if(!zis.ddList[oid])
                zis.ddList[oid]={};
            zis.ddList[oid][ref]={};
            for(i in json)
                zis.ddList[oid][ref][i]=json[i];
            zis.fillInDdl(vars.el,vars.vals);
        }
    }
    fillInDdl(el,vals){
        var i,j=0,h='',ref=$(el).find('select').attr('ref-id')
            ,val=$(el).find('select option[selected]').html()
            ,oldId=$(el).find('select option[selected]').attr('value');
        const oid=this.findParent(el,this);  
        if(this.ddList[oid]&&this.ddList[oid][ref]){ 
            for(i in this.ddList[oid][ref]){
                j++;
                if(vals.indexOf(this.ddList[oid][ref][i])===-1)
                    h+='<option value="'+i+'">'+this.ddList[oid][ref][i]+'</option>';
            }
            $(el).find('select').append(h);
            $(el).find('select').attr('old-val',val).attr('old-id',oldId);
            if(j>=this.ddLLimit)
                $(el).find('select').attr('i-more',1)
            this.initSel2($(el).find('select'));
        }
        else
            newApi_('GET','_ref_reqs/'+ref+'?JSON&id='+oid+'&LIMIT='+this.ddLLimit,this.fillInDdlDo,'',{el:el,vals:vals},this);
    }
    findParent(el,zis=this){
        if (!zis) zis=smQ[0];        
        var oid;
        $(el).closest('tr').find('td[is-object=1]').each(function(){
            if(zis.metas[$(this).attr('req-id')]===0)
                oid=$(this).attr('obj-id');
        });
        return oid;
    }
    initSel2(el){
        var zis = this || smQ[0];        
        var curEl=el; 
        $(el).select2({
            tags: true,
            createTag: function (params) {
                let term = $.trim(params.term);
                if (term === '') return null;
                return {
                  id: '-1',
                  text: term,
                  newTag: true
                }
            },
            sorter: data => data.sort((a, b) => a.text.localeCompare(b.text)),
            placeholder: t9n('[RU]Выберите[EN]Select'),
            allowClear: true,
            ajax: $(curEl).attr('i-more') ? {
                url: function(params){
                    var requestURL=dborigin+'/'+db+'/_ref_reqs/'+$(this).closest('td').attr('req-id')+'?JSON&id='+zis.findParent(this,zis);
                    return requestURL;
                },
                headers: typeof user == 'object' ? { 'X-Authorization': user.authToken } : undefined,
                processResults: function(data){
                    var formattedData=[];
                    if(data)
                        for(var i in data)
                            if($(curEl).closest('td').find('span[ref='+i+']').length===0)
                                formattedData.push({"id":i, "text":data[i]});
                    return {results:formattedData};
                },
                dataType: 'json',
                cache: true,
                delay: 330
            } : undefined
        });
    }
    refreshLine(json,el){
        var zis = this || smQ[0];        
        $(el).closest('.sq-row').find('td[is-object=1]').each(function(){
            if(zis.metas[$(this).attr('req-id')]===0){
                zis.saveDone({},{el:this});
                return false;
            }
        });
    }
    saveDone(json,vars,zis=this){
        if (!zis) zis=smQ[0];        
        const reqId=$(vars.el).attr('req-id');
        $(zis.selId+'.saving').removeClass('saving');
        if(vars.id)
            $(vars.el).attr('ref-id',vars.id);
        if($(vars.el).attr('obj-id'))
            parent=$(vars.el);
        else
            parent=$(vars.el).closest('.sq-row').find('td[req-id='+zis.metas[reqId].id+']');
        const parentId=parent.attr('obj-id');
        const parentType=parent.attr('req-id');
        var fd=new FormData();
        fd.append('FR_'+$('#'+parentType).find('.sq-col-name').html()+'ID',parentId);
        if($(zis.selId+'input[filter-id='+reqId+']').val().length>0&&$('th[footer-id='+reqId+']').html().length>0)
            $(zis.selId+'th[footer-id='+reqId+']').css('color','red').prop('title', t9n('[RU]Возможно, значение неактуально из-за примененного фильтра[EN]The value might be not correct because of the filter applied'));
        else
            newApi_('POST','report/'+zis.id+'?JSON',zis.newRecGet,fd,{el:parent,mode:'edit'},zis);
        zis.postProcessHead();
    }
    delDone(json,el,zis=this){
        if (!zis) zis=smQ[0];        
        $(zis.selId+'.saving').removeClass('saving');
        zis.doApplyFilters('TOTALS');
        if(zis.metas[$(el).attr('req-id')]===0){
            if(zis.total)
                $(zis.selId+'.total-count-num').html(--zis.total);
            $(zis.selId+'td[obj-id='+$(el).attr('obj-id')+']').closest('.sq-row').remove();
            if($(zis.selId+'.sq-row').length===0){
                $(zis.selId+'.page-count-from').html('');
                $(zis.selId+'.page-count-to').html(0);
            }
            else
                $(zis.selId+'.page-count-to').html(parseInt($('.page-count-to').html())-1);
            return;
        }
        $(el).html('').attr('obj-id','').attr('ref-id','');
        for(var i in zis.metas)
            if(zis.metas[i].id===$(el).attr('req-id'))
                $(el).closest('.sq-row').find('td[req-id='+i+']').html('').attr('obj-id','').attr('ref-id','');
    }
    createDone(json,el,zis=this){
        if (!zis) zis=smQ[0];        
        if(json.warning){
            zis.errMsgCard(zis.escapeHtmls(val)+': '+json.warning);
            $(el).closest('tr').remove();
            $(zis.selId+'td[obj-id='+json.id+']').first().click();
            return;
        }
        $(el).removeClass('saving');
        $(el).attr('obj-id',json.id);
        $(el).html(json.val);
        if($(el).hasClass('sq-new')){
            $(el).removeClass('sq-new');
            if(zis.total)
                $(zis.selId+'.total-count-num').html(++zis.total);
            $(zis.selId+'.page-count-to').html(1+parseInt($(zis.selId+'.page-count-to').html()));
        }
        var fd=new FormData();
        fd.append('FR_'+$('#'+$(el).attr('req-id')).find('.sq-col-name').html()+'ID',json.id);
        newApi_('POST','report/'+zis.id+'?JSON',zis.newRecGet,fd,{el:el,mode:'new'},zis);
    }
    dropMsDone(json,i){
        $(zis.selId+'#'+i).remove();
    }
    addMsDone(json,el,zis=this){
        if (!zis) zis=smQ[0];        
        $(el).removeClass('saving').removeClass('editing').removeClass('last-edited');
    }
    createDicObj(json,el,zis=this){
        if (!zis) zis=smQ[0];        
        if(json.id){
            $(el).find('option:selected').attr('value',json.id);
            zis.ddList[zis.findParent(el,zis)][$(el).closest('td').attr('req-id')][json.id]=json.val;
            zis.saveRef(el);
        }
        else
            this.errMsgCard(t9n('[RU]Ошибка создания справочного значения[EN]Failed to create the dictionary value'));
    }
    saveRef(el){
        var zis=this;
        var td=$(el).closest('td')
            ,ref=$(el).attr('ref-id')
            ,pid=this.metas[td.attr('req-id')].id
            ,val=$(el).find('option:selected').text()||''
            ,i=$(el).closest('.sq-row').find('td[req-id='+pid+']').attr('obj-id');
        if(el.value==="-1"){ // New DDL item
            var fd=new FormData();
            const t=this.metas[$(el).attr('ref-id')].ref;
            fd.append('t'+t,val);
            newApi_('POST','_m_new/'+t+'?JSON&up=1',this.createDicObj,fd,el,this);
            return;
        }
        if(parseInt(i)){
            if($(el).attr('multi')){
                newApi_('POST','_m_set/'+i+'?JSON&t'+ref+'='+el.value,this.addMsDone,'',td,this);
                $(el).remove();
                val=td.attr('old-val')+(td.attr('old-val').length>0?',':'')+val;
                td.attr('old-val',val);
            }
            else{
                newApi_('POST','_m_set/'+i+'?JSON&t'+ref+'='+(el.value||''),this.saveDone,'',{el:td,id:el.value||''},this);
                for(i in this.metas)
                    if(this.metas[i].id===$(td).attr('req-id'))
                        $(td).closest('.sq-row').find('td[req-id='+i+']').html('').attr('obj-id','').attr('ref-id','');
            }
        }
        else{
            $(td).attr('value',el.value); // Save ref value in the cell, not the DB
            $(el).closest('.sq-row').find('td[req-id='+pid+']').click(); // then switch to fill in the first column
        }
        try{
            $(td).find('select.select2').select2('destroy');
        }
        catch {};
        td.removeClass('editing').html(val);
        $(zis.selId+'.same-object').html(val).attr('old-val',val);
        $(zis.selId+'.same-object').removeClass('same-object');
    }
    saveVal(elem){
        var zis = this || smQ[0];        
        var i,parent,req,val,digits=0,el=$(elem).closest('td'),dispVal;
        const type=$(el).attr('req-id');
        const base=$(el).attr('base');
        val=base==='NUMBER'&&elem.value!=''?Math.floor(elem.value):elem.value;
        if($(el).hasClass('saving')||!$(el).hasClass('editing')) // Blur and Change both might be triggered
            return;
        if($(el).hasClass('sq-new')&&val==='')
            return $(el).closest('.sq-row').remove();
        if(base==='DATE'){
            val=moment.utc(val).format("DD.MM.YYYY");
            if(!val.match(/^(\d\d\.\d\d\.\d\d\d\d)$/))
                val='';
        }
        else if(base==='DATETIME'){
            val=moment.utc(val).format("DD.MM.YYYY HH:mm:ss");
            if(!val.match(/^(\d\d\.\d\d\.\d\d\d\d \d\d:\d\d:\d\d)$/))
                val='';
        }
        if(val!=$(el).attr('old-val')){
            var up=1,fd=new FormData();
            fd.append('t'+type,val);
            if($(el).attr('is-object')==="1"){
                if($(el).attr('obj-id')>0){
                    if(val==='')
                        newApi_('POST','_m_del/'+$(el).attr('obj-id')+'?JSON',this.delDone,fd,el,this);
                    else
                        newApi_('POST','_m_save/'+$(el).attr('obj-id')+'?JSON',this.saveDone,fd,{el:el},this);
                }
                else{
                    if(val===''){ // Delete the record
                        $(el).removeClass('editing').html(val).attr('old-val',val);
                        $(zis.selId+'.same-object').removeClass('same-object');
                        return;
                    }
                    if(this.arrs[type])
                        up=$(el).closest('.sq-row').find('td[req-id='+this.arrs[type]+']').attr('obj-id')
                            ||$(el).closest('.sq-row').find('td[req-id='+this.arrs[type]+']').attr('ref-id');
                    for(i in this.metas)
                        if(this.metas[i].id===type&&this.metas[i].refId)
                            if(req=el.closest('tr').find('td[req-id='+i+']').attr('value'))
                                fd.append('t'+i,req);
                    newApi_('POST','_m_new/'+type+'?JSON&up='+up,this.createDone,fd,el,this);
                }
            }
            else{
                i=this.metas[type].id;
                i=$(el).closest('.sq-row').find('td[req-id='+i+'][is-object=1]').attr(zis.metas[i].refId?'ref-id':'obj-id');
                if(i)
                    newApi_('POST','_m_save/'+i+'?JSON',this.saveDone,fd,{el:el},this);
                else{
                    this.errMsgCard('Ошибка: Отсутствует ID. Возможно, стоит добавить колонку '+$('#'+type).find('.sq-col-name').html()+'ID.');
                    return $(elem).addClass('bg-danger');
                }
            }
            $(el).addClass('saving');
        }
        $(el).removeClass('editing editing-text');
        dispVal = this.isNumeric($(el).attr('base')) ? this.formatNum(val,$(el).attr('base')) : val;
        $(el).html(dispVal).attr('old-val',val);
        if(base==='MEMO') this.addBreaks(el);
        $(zis.selId+'.same-object').html(dispVal).attr('old-val',val);
        $(zis.selId+'.same-object').removeClass('same-object');
    }
    formatNum(n,f){
        var digits = f === 'NUMBER' ? 0 : 2;
        var value = n === '' ? '' : Intl.NumberFormat(undefined,{
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
            useGrouping:true
        }).format(parseFloat(n));
        return value.replace(/(\u00A0|&nbsp;)/g, ' ');
    }
    saveInlineFileDone(json,el){
        const v='<a target="_blank" href="/'+json.args+'">'+$(el).find('input').get(0).files.item(0).name+'</a>';
        $(el).html(v);
        $(el).removeClass('editing editing-text');
        $(el).attr('v',v);
        this.saveDone({},{el:el});
    }
    saveInlineFile(el){
        var fd=new FormData(),td=$(el).closest('td');
        if(el.files[0]&&el.files[0].name){
            fd.append('t'+$(el).closest('td').attr('req-id'),el.files[0],el.files[0].name);
            newApi_('POST','_m_set/'+this.findParent(el)+'?JSON',this.saveInlineFileDone,fd,td,this);
            $(el).removeClass('last-edited');
        }
        else{
            $(el).closest('td').html($(el).closest('td').attr('old-val'));
            td.removeClass('editing editing-text');
        }
    }
    deleteFile(el){
        newApi_('POST','_m_set/'+this.findParent(el)+'?JSON',this.deleteFileDone,'t'+$(el).closest('td').attr('req-id'),el,this);
    }
    deleteFileDone(json,el){
        const td=$(el).closest('td');
        td.html('');
        this.saveDone({},{el:td});
    }
    getMeta(json,refId,zis=this){
        if (!zis) zis=smQ[0];        
        zis.baseType[json.id]=zis.bt[json.type];
        zis.uniq[json.id]=json.unique;
        for(var i in json.reqs){
            zis.baseType[json.reqs[i].id]=zis.bt[json.reqs[i].type];
            zis.metas[json.reqs[i].id]={id:refId||json.id
                                    ,arrId:json.reqs[i].arr_id
                                    ,refId:json.reqs[i].ref_id
                                    ,ref:json.reqs[i].ref
                                    ,multi:json.reqs[i].attrs&&json.reqs[i].attrs.indexOf(":MULTI:")!==-1
                                    ,type:json.reqs[i].type};
            if(json.reqs[i].arr_id)
                zis.arrs[json.reqs[i].arr_id]=zis.metas[json.reqs[i].arr_id]=refId||json.id;
            // Get ref column's reqs in case we have those in the report
            if(json.reqs[i].ref_id&&$('#'+json.reqs[i].id).length>0)
                newApi_('GET','metadata/'+json.reqs[i].ref,zis.getMeta,'',json.reqs[i].id,zis);  // Set the Ref as parent for this req
        }
    }
    getSmart(json,zis=this){
        if (!zis) zis=smQ[0];        
        try{
            if(json.obj.typ!=='22')
                return zis.errMsgCard('Ошибка: Неверный тип объекта '+json.obj.typ);
        }
        catch(e){
            return zis.errMsgCard('Ошибка: '+e+' '+json);
        }
        $(zis.selId+'.rep-header').html(json.obj.val);
        zis.limit=zis.defaultLimit=parseInt(json.reqs[134].value)||zis.defaultLimit;
        zis.doApplyFilters();
    }
    doApplyFilters(p){
        var zis=this;
        var val;
        var fd=new FormData();
        this.filters={};
        this.lastK='';
        $(zis.selId+'.filters input').each(function(){
            if(this.value!==''){
                $(zis.selId+'.clear-filters').show();
                $(zis.selId+'.refr').removeClass('ml-2');
                if(this.value==='%'||this.value==='!%'||this.value.substr(0,1)==='@'||this.value.substr(0,2)==='!@')
                    val=this.value;
                else
                    switch($(this).attr('base')){
                        case "NUMBER":
                        case "SIGNED":
                        case "DATE":
                        case "DATETIME":
                        case "BOOLEAN":
                            val=this.value;
                            break;
                        default:
                            val=this.value.indexOf('%')===-1?'%'+this.value.replace(/ /g,'%')+'%':this.value;
                    }
                fd.append($(this).attr('name'),val);
            }
        });
        if(p==='RECORD_COUNT')
            newApi_('POST','report/'+this.id+'?JSON&RECORD_COUNT',this.getCountDone,fd,this);
        else if(p==='TOTALS'){
            if($(zis.selId+'.sq-table tfoot').length>0||this.totalsOn)
                newApi_('POST','report/'+this.id+'?JSON',this.drawFoot,fd,undefined,this);
        }
        else{
            if(!p){
                const urlParams=this.getFilterParams();
                for(let key in urlParams)
                    fd.append(key,urlParams[key]);
            }
            if(p===-2) // First page
                p=0,this.page=1;
            else if(p===2&&this.total) // Last page
                p=0,this.page=Math.ceil(this.total/this.limit);
            this.page+=p||0;
            $(zis.selId+'.ajax-wait').show();
            newApi_('POST','report/'+this.id+'?JSON&LIMIT='+(this.page===1?'':this.limit*(this.page-1)+',')+this.limit+this.collectOrder(),this.getRep,fd,this);
        }
    }
    getFilterParams(){
        let params = {};
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.forEach(function(value, key) {
            if(value!==''){
                var val;                
                if(value==='%'||value==='!%'||value.substr(0,1)==='@'||value.substr(0,2)==='!@')
                    val=value;
                else {
                    const prefix = key.split('_')[0];
                    switch(prefix){
                        case "FR":
                        case "TO":
                            val=value;
                            break;
                        default:
                            val=value.indexOf('%')===-1?'%'+value.replace(/ /g,'%')+'%':value;
                    }
                }
                params[key] = val;
            }
        });
        return params;
    }
    collectOrder(){
        var zis=this;
        var o=[];
        $(zis.selId+'.sq-table th a').each(function(){
            if($(this).attr('sq-order')!=='')
                o[$(this).attr('sq-order')-1]=($(this).attr('desc')===''?'':'-')+$(this).attr('col-id');
        });
        return o.length>0?'&ORDER='+o.join(','):'';
    }
    getCount(){
        var zis = this || smQ[0];             
        $(zis.selId+'.total-count-num').html(svgStore.waitGif);
        this.doApplyFilters('RECORD_COUNT');
    }
    getCountDone(json,zis=this){
        if (!zis) zis=smQ[0];        
        zis.total=json.count;
        $(zis.selId+'.total-count-from').html(t9n('[RU] из [EN] of '));
        $(zis.selId+'.total-count-num').html(zis.total);
    }
    applyFilters(el){
        if(this.lastK!==el.value||el.value===''){
            window.clearTimeout(this.timer); // Включить задержку, чтобы дать пользователю набрать текст поиска
            this.lastK=el.value;
            // Запустить поиск через XXXмс после последнего нажатия клавиши в поле поиска
            this.timer=setTimeout(()=>{
                this.page=1;
                this.total=undefined;
                this.doApplyFilters(-2);
            },333);
        }
    }
    escapeHtmls(t){
        t=t||'';
        if(!search.full&&t.length>127)
            t=t.substr(0,127)+'...';
        return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    escapeRegex(string){
        return string.replace(/[/\-\\^$*+?.()|[\]{}]/g,'\\$&');
    }
    getRoundedDecimalString(string) {    // NOT USED !!!!
        var lastPartNum = +('0.' + string);
        return (Math.round((lastPartNum + Number.EPSILON) * 100) / 100).toFixed(2).slice(2,4);
    }
    markDown(el){
        if(el&&el.innerHTML.indexOf('***')===-1&&el.innerHTML.indexOf('~~~')===-1&&el.innerHTML.indexOf('___')===-1)
            el.innerHTML=el.innerHTML.replace(/\*\*(.+?)\*\*(?!\*)/g,'<b>$1</b>')
                                    .replace(/__(.+?)__(?!\_)/g,'<i>$1</i>')
                                    .replace(/~~(.+?)~~(?!\~)/g,'<s>$1</s>');
    }
    columnResize(el){
        var tHeader = el.parentNode,
            tColumns = [],
            table = tHeader.parentNode.parentNode.parentNode;
        function setWidth(el,value){ el.style.minWidth = el.style.maxWidth = value+'px'; } 
        // function setWidth(el,value){ el.style.width = value+'px'; } 
        function onMouseMove(event){
            var thOffset = 0;
            var obj = tHeader;
            while (obj != null) {
                thOffset += obj.offsetLeft;
                obj = obj.offsetParent;
            }
            var newWidth = 3 + document.documentElement.scrollLeft + event.clientX - thOffset;
            var delta = newWidth - tHeader.clientWidth;
            setWidth(table, table.clientWidth + delta);
            tColumns.forEach(el => setWidth(el.header, el.size));
            setWidth(tHeader, newWidth);
        }
        function onMouseUp(){
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        }
        
        document.querySelectorAll(this.selId+'th').forEach(header => { 
            tColumns.push({ header, size: header.clientWidth });
            setWidth(header, header.clientWidth);
        });
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);     
    }
}

/** Collection of SVG-images */
var svgStore = { 
    clearButton: '<svg width="36" height="36" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" style="/* display: inline; *//* margin-top: -4px; */"><path d="M8.64284 8.64287L13.3571 13.3572M13.3571 8.64287L8.64284 13.3572" stroke="#1A1A1A" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
    
    triangularBracketsButton: '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 19L22 14L17 9M11 9L6 14L11 19" stroke="#1A1A1A" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    
    addRowBigButton: '<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 12.8572V23.1429M12.8571 18H23.1428M8.99999 6.42859H27C28.4201 6.42859 29.5714 7.57986 29.5714 9.00002V27C29.5714 28.4202 28.4201 29.5714 27 29.5714H8.99999C7.57983 29.5714 6.42856 28.4202 6.42856 27V9.00002C6.42856 7.57986 7.57983 6.42859 8.99999 6.42859Z" stroke="#1A1A1A" stroke-linecap="round" stroke-linejoin="round"/> </svg>',
    
    resetFiltersLens: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M25 25L19.6833 19.6833M22.5555 12.7777C22.5555 18.1778 18.1778 22.5555 12.7777 22.5555C7.37764 22.5555 3 18.1778 3 12.7777C3 7.37764 7.37764 3 12.7777 3C18.1778 3 22.5555 7.37764 22.5555 12.7777Z" stroke="#1A1A1A" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 8L18 18M18 8L8 18" stroke="#1A1A1A" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    
    refreshButton: '<svg class="ml-2 refr" width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M25 5.99763V11.9976M25 11.9976H19M25 11.9976L20.36 7.63763C19.2853 6.56235 17.9556 5.77684 16.4952 5.35441C15.0348 4.93198 13.4911 4.88639 12.0083 5.22189C10.5255 5.5574 9.1518 6.26307 8.01547 7.27305C6.87913 8.28304 6.01717 9.56442 5.51 10.9976M3 21.9976V15.9976M3 15.9976H9M3 15.9976L7.64 20.3576C8.71475 21.4329 10.0444 22.2184 11.5048 22.6409C12.9652 23.0633 14.5089 23.1089 15.9917 22.7734C17.4745 22.4379 18.8482 21.7322 19.9845 20.7222C21.1209 19.7122 21.9828 18.4308 22.49 16.9976" stroke="#1A1A1A" stroke-linecap="round" stroke-linejoin="round"/></svg><svg class="ml-2 refr" width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:none"><path d="M3 5.99763V11.9976M3 11.9976H9M3 11.9976L7.64 7.63763C8.71475 6.56235 10.0444 5.77684 11.5048 5.35441C12.9652 4.93198 14.5089 4.88639 15.9917 5.22189C17.4745 5.5574 18.8482 6.26307 19.9845 7.27305C21.1209 8.28304 21.9828 9.56442 22.49 10.9976M25 21.9976V15.9976M25 15.9976H19M25 15.9976L20.36 20.3576C19.2853 21.4329 17.9556 22.2184 16.4952 22.6409C15.0348 23.0633 13.4911 23.1089 12.0083 22.7734C10.5255 22.4379 9.1518 21.7322 8.01547 20.7222C6.87913 19.7122 6.01717 18.4308 5.51 16.9976" stroke="#1A1A1A" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    
    configButton: '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 17C15.6569 17 17 15.6569 17 14C17 12.3431 15.6569 11 14 11C12.3431 11 11 12.3431 11 14C11 15.6569 12.3431 17 14 17Z" stroke="#1A1A1A" stroke-linecap="round" stroke-linejoin="round"/><path d="M21.4 17C21.2669 17.3016 21.2272 17.6362 21.286 17.9606C21.3448 18.285 21.4995 18.5843 21.73 18.82L21.79 18.88C21.976 19.0657 22.1235 19.2863 22.2241 19.5291C22.3248 19.7719 22.3766 20.0322 22.3766 20.295C22.3766 20.5578 22.3248 20.8181 22.2241 21.0609C22.1235 21.3037 21.976 21.5243 21.79 21.71C21.6043 21.896 21.3837 22.0435 21.1409 22.1441C20.8981 22.2448 20.6378 22.2966 20.375 22.2966C20.1122 22.2966 19.8519 22.2448 19.6091 22.1441C19.3663 22.0435 19.1457 21.896 18.96 21.71L18.9 21.65C18.6643 21.4195 18.365 21.2648 18.0406 21.206C17.7162 21.1472 17.3816 21.1869 17.08 21.32C16.7842 21.4468 16.532 21.6572 16.3543 21.9255C16.1766 22.1938 16.0813 22.5082 16.08 22.83V23C16.08 23.5304 15.8693 24.0391 15.4942 24.4142C15.1191 24.7893 14.6104 25 14.08 25C13.5496 25 13.0409 24.7893 12.6658 24.4142C12.2907 24.0391 12.08 23.5304 12.08 23V22.91C12.0723 22.579 11.9651 22.258 11.7725 21.9887C11.5799 21.7194 11.3107 21.5143 11 21.4C10.6984 21.2669 10.3638 21.2272 10.0394 21.286C9.71502 21.3448 9.41568 21.4995 9.18 21.73L9.12 21.79C8.93425 21.976 8.71368 22.1235 8.47088 22.2241C8.22808 22.3248 7.96783 22.3766 7.705 22.3766C7.44217 22.3766 7.18192 22.3248 6.93912 22.2241C6.69632 22.1235 6.47575 21.976 6.29 21.79C6.10405 21.6043 5.95653 21.3837 5.85588 21.1409C5.75523 20.8981 5.70343 20.6378 5.70343 20.375C5.70343 20.1122 5.75523 19.8519 5.85588 19.6091C5.95653 19.3663 6.10405 19.1457 6.29 18.96L6.35 18.9C6.58054 18.6643 6.73519 18.365 6.794 18.0406C6.85282 17.7162 6.81312 17.3816 6.68 17.08C6.55324 16.7842 6.34276 16.532 6.07447 16.3543C5.80618 16.1766 5.49179 16.0813 5.17 16.08H5C4.46957 16.08 3.96086 15.8693 3.58579 15.4942C3.21071 15.1191 3 14.6104 3 14.08C3 13.5496 3.21071 13.0409 3.58579 12.6658C3.96086 12.2907 4.46957 12.08 5 12.08H5.09C5.42099 12.0723 5.742 11.9651 6.0113 11.7725C6.28059 11.5799 6.48572 11.3107 6.6 11C6.73312 10.6984 6.77282 10.3638 6.714 10.0394C6.65519 9.71502 6.50054 9.41568 6.27 9.18L6.21 9.12C6.02405 8.93425 5.87653 8.71368 5.77588 8.47088C5.67523 8.22808 5.62343 7.96783 5.62343 7.705C5.62343 7.44217 5.67523 7.18192 5.77588 6.93912C5.87653 6.69632 6.02405 6.47575 6.21 6.29C6.39575 6.10405 6.61632 5.95653 6.85912 5.85588C7.10192 5.75523 7.36217 5.70343 7.625 5.70343C7.88783 5.70343 8.14808 5.75523 8.39088 5.85588C8.63368 5.95653 8.85425 6.10405 9.04 6.29L9.1 6.35C9.33568 6.58054 9.63502 6.73519 9.95941 6.794C10.2838 6.85282 10.6184 6.81312 10.92 6.68H11C11.2958 6.55324 11.548 6.34276 11.7257 6.07447C11.9034 5.80618 11.9987 5.49179 12 5.17V5C12 4.46957 12.2107 3.96086 12.5858 3.58579C12.9609 3.21071 13.4696 3 14 3C14.5304 3 15.0391 3.21071 15.4142 3.58579C15.7893 3.96086 16 4.46957 16 5V5.09C16.0013 5.41179 16.0966 5.72618 16.2743 5.99447C16.452 6.26276 16.7042 6.47324 17 6.6C17.3016 6.73312 17.6362 6.77282 17.9606 6.714C18.285 6.65519 18.5843 6.50054 18.82 6.27L18.88 6.21C19.0657 6.02405 19.2863 5.87653 19.5291 5.77588C19.7719 5.67523 20.0322 5.62343 20.295 5.62343C20.5578 5.62343 20.8181 5.67523 21.0609 5.77588C21.3037 5.87653 21.5243 6.02405 21.71 6.21C21.896 6.39575 22.0435 6.61632 22.1441 6.85912C22.2448 7.10192 22.2966 7.36217 22.2966 7.625C22.2966 7.88783 22.2448 8.14808 22.1441 8.39088C22.0435 8.63368 21.896 8.85425 21.71 9.04L21.65 9.1C21.4195 9.33568 21.2648 9.63502 21.206 9.95941C21.1472 10.2838 21.1869 10.6184 21.32 10.92V11C21.4468 11.2958 21.6572 11.548 21.9255 11.7257C22.1938 11.9034 22.5082 11.9987 22.83 12H23C23.5304 12 24.0391 12.2107 24.4142 12.5858C24.7893 12.9609 25 13.4696 25 14C25 14.5304 24.7893 15.0391 24.4142 15.4142C24.0391 15.7893 23.5304 16 23 16H22.91C22.5882 16.0013 22.2738 16.0966 22.0055 16.2743C21.7372 16.452 21.5268 16.7042 21.4 17Z" stroke="#1A1A1A" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    
    firstPageButton: '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 19L8 14L13 9M20 19L15 14L20 9" stroke="#1A1A1A" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    
    prevPageButton: '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 20L11 14L17 8" stroke="#1A1A1A" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    
    nextPageButton: '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 20L17 14L11 8" stroke="#1A1A1A" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    
    lastPageButton: '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 19L20 14L15 9M8 19L13 14L8 9" stroke="#1A1A1A" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    
    dropButton: '<svg width="12" height="12" viewBox="0 0 12 12" class="flex-none drop-svg ml-1"><path fill-rule="evenodd" fill="currentColor" d="M7.41421356,6 L9.88226406,3.5319495 C10.0816659,3.33254771 10.0828664,3.01179862 9.88577489,2.81470708 L9.18529292,2.11422511 C8.97977275,1.90870494 8.66708101,1.91870543 8.4680505,2.11773594 L6,4.58578644 L3.5319495,2.11773594 C3.33254771,1.91833414 3.01179862,1.91713357 2.81470708,2.11422511 L2.11422511,2.81470708 C1.90870494,3.02022725 1.91870543,3.33291899 2.11773594,3.5319495 L4.58578644,6 L2.11773594,8.4680505 C1.91833414,8.66745229 1.91713357,8.98820138 2.11422511,9.18529292 L2.81470708,9.88577489 C3.02022725,10.0912951 3.33291899,10.0812946 3.5319495,9.88226406 L6,7.41421356 L8.4680505,9.88226406 C8.66745229,10.0816659 8.98820138,10.0828664 9.18529292,9.88577489 L9.88577489,9.18529292 C10.0912951,8.97977275 10.0812946,8.66708101 9.88226406,8.4680505 L7.41421356,6 L7.41421356,6 Z"></path></svg>',
    
    addButton: '<svg width="28" height="28" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 12.8572V23.1429M12.8571 18H23.1428M8.99999 6.42859H27C28.4201 6.42859 29.5714 7.57986 29.5714 9.00002V27C29.5714 28.4202 28.4201 29.5714 27 29.5714H8.99999C7.57983 29.5714 6.42856 28.4202 6.42856 27V9.00002C6.42856 7.57986 7.57983 6.42859 8.99999 6.42859Z" stroke="#1A1A1A" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    
    dubButton: '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M7 17H6C5.46957 17 4.96086 16.7893 4.58579 16.4142C4.21071 16.0391 4 15.5304 4 15V6C4 5.46957 4.21071 4.96086 4.58579 4.58579C4.96086 4.21071 5.46957 4 6 4H15C15.5304 4 16.0391 4.21071 16.4142 4.58579C16.7893 4.96086 17 5.46957 17 6V7M13 11H22C23.1046 11 24 11.8954 24 13V22C24 23.1046 23.1046 24 22 24H13C11.8954 24 11 23.1046 11 22V13C11 11.8954 11.8954 11 13 11Z" stroke="#1A1A1A" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    
    delButton: '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 8H23M10 8V6C10 5.46957 10.2107 4.96086 10.5858 4.58579C10.9609 4.21071 11.4696 4 12 4H16C16.5304 4 17.0391 4.21071 17.4142 4.58579C17.7893 4.96086 18 5.46957 18 6V8M21 8V22C21 22.5304 20.7893 23.0391 20.4142 23.4142C20.0391 23.7893 19.5304 24 19 24H9C8.46957 24 7.96086 23.7893 7.58579 23.4142C7.21071 23.0391 7 22.5304 7 22V8H21Z" stroke="#1A1A1A" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
    
    waitGif: '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 4V8M14 20V24M6.93 6.93L9.76 9.76M18.24 18.24L21.07 21.07M4 14H8M20 14H24M6.93 21.07L9.76 18.24M18.24 9.76L21.07 6.93" stroke="#1A1A1A" stroke-linecap="round" stroke-linejoin="round"/></svg>'
}

if (typeof ig !== 'object') {
    let ids = search?.addsq ? id+','+search?.addsq : ''+id
    let i=0;
    ids.split(',').forEach( el => {
        var container = document.createElement('div');
        container.classList.add('sq-container');
        byId('SqTables').appendChild(container);
        smQ[i] = new SmartQ(i, el); 
        smQ[i].init(container);
        i+=1;
    });
    window.smQ = smQ;    
}

// export default SmartQ;