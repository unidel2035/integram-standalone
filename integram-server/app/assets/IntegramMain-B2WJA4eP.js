import{B as ge,a7 as Te,R as ve,a8 as ze,a9 as Re,s as J,aa as _,z as H,ab as le,ac as ye,ad as q,q as K,ae as _e,af as U,ag as te,m as b,y as A,u as ne,c as p,o,F as E,r as $,b as w,a as h,h as P,j as W,g as j,k as B,t as S,n as Be,i as T,A as k,ah as Ue,ai as je,aj as He,p as we,ak as Ge,al as qe,am as Ze,an as Y,ao as We,ap as Z,w as O,T as Je,f as ke,_ as Qe,L as de,K as me,D as ce,d as x,I as N,U as be,J as fe,P as X}from"./index-BrdfL8RF.js";import{s as Ye}from"./index-CzLm9tvn.js";import{s as Xe}from"./index-Ww0kb0ox.js";import{s as $e}from"./index-C6QejG5T.js";import{i as y}from"./integramApiClient-C3_j8SPw.js";import{S as et}from"./SafeRouterView-ID1VOhSZ.js";import"./index-B9ygI19o.js";import"./unifiedAuthService-xCuNj-Bd.js";var tt=`
    .p-menubar {
        display: flex;
        align-items: center;
        background: dt('menubar.background');
        border: 1px solid dt('menubar.border.color');
        border-radius: dt('menubar.border.radius');
        color: dt('menubar.color');
        padding: dt('menubar.padding');
        gap: dt('menubar.gap');
    }

    .p-menubar-start,
    .p-megamenu-end {
        display: flex;
        align-items: center;
    }

    .p-menubar-root-list,
    .p-menubar-submenu {
        display: flex;
        margin: 0;
        padding: 0;
        list-style: none;
        outline: 0 none;
    }

    .p-menubar-root-list {
        align-items: center;
        flex-wrap: wrap;
        gap: dt('menubar.gap');
    }

    .p-menubar-root-list > .p-menubar-item > .p-menubar-item-content {
        border-radius: dt('menubar.base.item.border.radius');
    }

    .p-menubar-root-list > .p-menubar-item > .p-menubar-item-content > .p-menubar-item-link {
        padding: dt('menubar.base.item.padding');
    }

    .p-menubar-item-content {
        transition:
            background dt('menubar.transition.duration'),
            color dt('menubar.transition.duration');
        border-radius: dt('menubar.item.border.radius');
        color: dt('menubar.item.color');
    }

    .p-menubar-item-link {
        cursor: pointer;
        display: flex;
        align-items: center;
        text-decoration: none;
        overflow: hidden;
        position: relative;
        color: inherit;
        padding: dt('menubar.item.padding');
        gap: dt('menubar.item.gap');
        user-select: none;
        outline: 0 none;
    }

    .p-menubar-item-label {
        line-height: 1;
    }

    .p-menubar-item-icon {
        color: dt('menubar.item.icon.color');
    }

    .p-menubar-submenu-icon {
        color: dt('menubar.submenu.icon.color');
        margin-left: auto;
        font-size: dt('menubar.submenu.icon.size');
        width: dt('menubar.submenu.icon.size');
        height: dt('menubar.submenu.icon.size');
    }

    .p-menubar-submenu .p-menubar-submenu-icon:dir(rtl) {
        margin-left: 0;
        margin-right: auto;
    }

    .p-menubar-item.p-focus > .p-menubar-item-content {
        color: dt('menubar.item.focus.color');
        background: dt('menubar.item.focus.background');
    }

    .p-menubar-item.p-focus > .p-menubar-item-content .p-menubar-item-icon {
        color: dt('menubar.item.icon.focus.color');
    }

    .p-menubar-item.p-focus > .p-menubar-item-content .p-menubar-submenu-icon {
        color: dt('menubar.submenu.icon.focus.color');
    }

    .p-menubar-item:not(.p-disabled) > .p-menubar-item-content:hover {
        color: dt('menubar.item.focus.color');
        background: dt('menubar.item.focus.background');
    }

    .p-menubar-item:not(.p-disabled) > .p-menubar-item-content:hover .p-menubar-item-icon {
        color: dt('menubar.item.icon.focus.color');
    }

    .p-menubar-item:not(.p-disabled) > .p-menubar-item-content:hover .p-menubar-submenu-icon {
        color: dt('menubar.submenu.icon.focus.color');
    }

    .p-menubar-item-active > .p-menubar-item-content {
        color: dt('menubar.item.active.color');
        background: dt('menubar.item.active.background');
    }

    .p-menubar-item-active > .p-menubar-item-content .p-menubar-item-icon {
        color: dt('menubar.item.icon.active.color');
    }

    .p-menubar-item-active > .p-menubar-item-content .p-menubar-submenu-icon {
        color: dt('menubar.submenu.icon.active.color');
    }

    .p-menubar-submenu {
        display: none;
        position: absolute;
        min-width: 12.5rem;
        z-index: 1;
        background: dt('menubar.submenu.background');
        border: 1px solid dt('menubar.submenu.border.color');
        border-radius: dt('menubar.submenu.border.radius');
        box-shadow: dt('menubar.submenu.shadow');
        color: dt('menubar.submenu.color');
        flex-direction: column;
        padding: dt('menubar.submenu.padding');
        gap: dt('menubar.submenu.gap');
    }

    .p-menubar-submenu .p-menubar-separator {
        border-block-start: 1px solid dt('menubar.separator.border.color');
    }

    .p-menubar-submenu .p-menubar-item {
        position: relative;
    }

    .p-menubar-submenu > .p-menubar-item-active > .p-menubar-submenu {
        display: block;
        left: 100%;
        top: 0;
    }

    .p-menubar-end {
        margin-left: auto;
        align-self: center;
    }

    .p-menubar-end:dir(rtl) {
        margin-left: 0;
        margin-right: auto;
    }

    .p-menubar-button {
        display: none;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        width: dt('menubar.mobile.button.size');
        height: dt('menubar.mobile.button.size');
        position: relative;
        color: dt('menubar.mobile.button.color');
        border: 0 none;
        background: transparent;
        border-radius: dt('menubar.mobile.button.border.radius');
        transition:
            background dt('menubar.transition.duration'),
            color dt('menubar.transition.duration'),
            outline-color dt('menubar.transition.duration');
        outline-color: transparent;
    }

    .p-menubar-button:hover {
        color: dt('menubar.mobile.button.hover.color');
        background: dt('menubar.mobile.button.hover.background');
    }

    .p-menubar-button:focus-visible {
        box-shadow: dt('menubar.mobile.button.focus.ring.shadow');
        outline: dt('menubar.mobile.button.focus.ring.width') dt('menubar.mobile.button.focus.ring.style') dt('menubar.mobile.button.focus.ring.color');
        outline-offset: dt('menubar.mobile.button.focus.ring.offset');
    }

    .p-menubar-mobile {
        position: relative;
    }

    .p-menubar-mobile .p-menubar-button {
        display: flex;
    }

    .p-menubar-mobile .p-menubar-root-list {
        position: absolute;
        display: none;
        width: 100%;
        flex-direction: column;
        top: 100%;
        left: 0;
        z-index: 1;
        padding: dt('menubar.submenu.padding');
        background: dt('menubar.submenu.background');
        border: 1px solid dt('menubar.submenu.border.color');
        box-shadow: dt('menubar.submenu.shadow');
        border-radius: dt('menubar.submenu.border.radius');
        gap: dt('menubar.submenu.gap');
    }

    .p-menubar-mobile .p-menubar-root-list:dir(rtl) {
        left: auto;
        right: 0;
    }

    .p-menubar-mobile .p-menubar-root-list > .p-menubar-item > .p-menubar-item-content > .p-menubar-item-link {
        padding: dt('menubar.item.padding');
    }

    .p-menubar-mobile-active .p-menubar-root-list {
        display: flex;
    }

    .p-menubar-mobile .p-menubar-root-list .p-menubar-item {
        width: 100%;
        position: static;
    }

    .p-menubar-mobile .p-menubar-root-list .p-menubar-separator {
        border-block-start: 1px solid dt('menubar.separator.border.color');
    }

    .p-menubar-mobile .p-menubar-root-list > .p-menubar-item > .p-menubar-item-content .p-menubar-submenu-icon {
        margin-left: auto;
        transition: transform 0.2s;
    }

    .p-menubar-mobile .p-menubar-root-list > .p-menubar-item > .p-menubar-item-content .p-menubar-submenu-icon:dir(rtl),
    .p-menubar-mobile .p-menubar-submenu-icon:dir(rtl) {
        margin-left: 0;
        margin-right: auto;
    }

    .p-menubar-mobile .p-menubar-root-list > .p-menubar-item-active > .p-menubar-item-content .p-menubar-submenu-icon {
        transform: rotate(-180deg);
    }

    .p-menubar-mobile .p-menubar-submenu .p-menubar-submenu-icon {
        transition: transform 0.2s;
        transform: rotate(90deg);
    }

    .p-menubar-mobile .p-menubar-item-active > .p-menubar-item-content .p-menubar-submenu-icon {
        transform: rotate(-90deg);
    }

    .p-menubar-mobile .p-menubar-submenu {
        width: 100%;
        position: static;
        box-shadow: none;
        border: 0 none;
        padding-inline-start: dt('menubar.submenu.mobile.indent');
        padding-inline-end: 0;
    }
`,nt={submenu:function(e){var n=e.instance,i=e.processedItem;return{display:n.isItemActive(i)?"flex":"none"}}},it={root:function(e){var n=e.instance;return["p-menubar p-component",{"p-menubar-mobile":n.queryMatches,"p-menubar-mobile-active":n.mobileActive}]},start:"p-menubar-start",button:"p-menubar-button",rootList:"p-menubar-root-list",item:function(e){var n=e.instance,i=e.processedItem;return["p-menubar-item",{"p-menubar-item-active":n.isItemActive(i),"p-focus":n.isItemFocused(i),"p-disabled":n.isItemDisabled(i)}]},itemContent:"p-menubar-item-content",itemLink:"p-menubar-item-link",itemIcon:"p-menubar-item-icon",itemLabel:"p-menubar-item-label",submenuIcon:"p-menubar-submenu-icon",submenu:"p-menubar-submenu",separator:"p-menubar-separator",end:"p-menubar-end"},at=ge.extend({name:"menubar",style:tt,classes:it,inlineStyles:nt}),rt={name:"BaseMenubar",extends:J,props:{model:{type:Array,default:null},buttonProps:{type:null,default:null},breakpoint:{type:String,default:"960px"},ariaLabelledby:{type:String,default:null},ariaLabel:{type:String,default:null}},style:at,provide:function(){return{$pcMenubar:this,$parentInstance:this}}},Le={name:"MenubarSub",hostName:"Menubar",extends:J,emits:["item-mouseenter","item-click","item-mousemove"],props:{items:{type:Array,default:null},root:{type:Boolean,default:!1},popup:{type:Boolean,default:!1},mobileActive:{type:Boolean,default:!1},templates:{type:Object,default:null},level:{type:Number,default:0},menuId:{type:String,default:null},focusedItemId:{type:String,default:null},activeItemPath:{type:Object,default:null}},list:null,methods:{getItemId:function(e){return"".concat(this.menuId,"_").concat(e.key)},getItemKey:function(e){return this.getItemId(e)},getItemProp:function(e,n,i){return e&&e.item?te(e.item[n],i):void 0},getItemLabel:function(e){return this.getItemProp(e,"label")},getItemLabelId:function(e){return"".concat(this.menuId,"_").concat(e.key,"_label")},getPTOptions:function(e,n,i){return this.ptm(i,{context:{item:e.item,index:n,active:this.isItemActive(e),focused:this.isItemFocused(e),disabled:this.isItemDisabled(e),level:this.level}})},isItemActive:function(e){return this.activeItemPath.some(function(n){return n.key===e.key})},isItemVisible:function(e){return this.getItemProp(e,"visible")!==!1},isItemDisabled:function(e){return this.getItemProp(e,"disabled")},isItemFocused:function(e){return this.focusedItemId===this.getItemId(e)},isItemGroup:function(e){return _(e.items)},onItemClick:function(e,n){this.getItemProp(n,"command",{originalEvent:e,item:n.item}),this.$emit("item-click",{originalEvent:e,processedItem:n,isFocus:!0})},onItemMouseEnter:function(e,n){this.$emit("item-mouseenter",{originalEvent:e,processedItem:n})},onItemMouseMove:function(e,n){this.$emit("item-mousemove",{originalEvent:e,processedItem:n})},getAriaPosInset:function(e){return e-this.calculateAriaSetSize.slice(0,e).length+1},getMenuItemProps:function(e,n){return{action:b({class:this.cx("itemLink"),tabindex:-1},this.getPTOptions(e,n,"itemLink")),icon:b({class:[this.cx("itemIcon"),this.getItemProp(e,"icon")]},this.getPTOptions(e,n,"itemIcon")),label:b({class:this.cx("itemLabel")},this.getPTOptions(e,n,"itemLabel")),submenuicon:b({class:this.cx("submenuIcon")},this.getPTOptions(e,n,"submenuIcon"))}}},computed:{calculateAriaSetSize:function(){var e=this;return this.items.filter(function(n){return e.isItemVisible(n)&&e.getItemProp(n,"separator")})},getAriaSetSize:function(){var e=this;return this.items.filter(function(n){return e.isItemVisible(n)&&!e.getItemProp(n,"separator")}).length}},components:{AngleRightIcon:Re,AngleDownIcon:ze},directives:{ripple:ve}},st=["id","aria-label","aria-disabled","aria-expanded","aria-haspopup","aria-setsize","aria-posinset","data-p-active","data-p-focused","data-p-disabled"],ot=["onClick","onMouseenter","onMousemove"],ut=["href","target"],lt=["id"],dt=["id"];function mt(t,e,n,i,s,a){var d=A("MenubarSub",!0),f=ne("ripple");return o(),p("ul",b({class:n.level===0?t.cx("rootList"):t.cx("submenu")},n.level===0?t.ptm("rootList"):t.ptm("submenu")),[(o(!0),p(E,null,$(n.items,function(r,u){return o(),p(E,{key:a.getItemKey(r)},[a.isItemVisible(r)&&!a.getItemProp(r,"separator")?(o(),p("li",b({key:0,id:a.getItemId(r),style:a.getItemProp(r,"style"),class:[t.cx("item",{processedItem:r}),a.getItemProp(r,"class")],role:"menuitem","aria-label":a.getItemLabel(r),"aria-disabled":a.isItemDisabled(r)||void 0,"aria-expanded":a.isItemGroup(r)?a.isItemActive(r):void 0,"aria-haspopup":a.isItemGroup(r)&&!a.getItemProp(r,"to")?"menu":void 0,"aria-setsize":a.getAriaSetSize,"aria-posinset":a.getAriaPosInset(u)},{ref_for:!0},a.getPTOptions(r,u,"item"),{"data-p-active":a.isItemActive(r),"data-p-focused":a.isItemFocused(r),"data-p-disabled":a.isItemDisabled(r)}),[h("div",b({class:t.cx("itemContent"),onClick:function(I){return a.onItemClick(I,r)},onMouseenter:function(I){return a.onItemMouseEnter(I,r)},onMousemove:function(I){return a.onItemMouseMove(I,r)}},{ref_for:!0},a.getPTOptions(r,u,"itemContent")),[n.templates.item?(o(),P(B(n.templates.item),{key:1,item:r.item,root:n.root,hasSubmenu:a.getItemProp(r,"items"),label:a.getItemLabel(r),props:a.getMenuItemProps(r,u)},null,8,["item","root","hasSubmenu","label","props"])):W((o(),p("a",b({key:0,href:a.getItemProp(r,"url"),class:t.cx("itemLink"),target:a.getItemProp(r,"target"),tabindex:"-1"},{ref_for:!0},a.getPTOptions(r,u,"itemLink")),[n.templates.itemicon?(o(),P(B(n.templates.itemicon),{key:0,item:r.item,class:j(t.cx("itemIcon"))},null,8,["item","class"])):a.getItemProp(r,"icon")?(o(),p("span",b({key:1,class:[t.cx("itemIcon"),a.getItemProp(r,"icon")]},{ref_for:!0},a.getPTOptions(r,u,"itemIcon")),null,16)):w("",!0),h("span",b({id:a.getItemLabelId(r),class:t.cx("itemLabel")},{ref_for:!0},a.getPTOptions(r,u,"itemLabel")),S(a.getItemLabel(r)),17,lt),a.getItemProp(r,"items")?(o(),p(E,{key:2},[n.templates.submenuicon?(o(),P(B(n.templates.submenuicon),{key:0,root:n.root,active:a.isItemActive(r),class:j(t.cx("submenuIcon"))},null,8,["root","active","class"])):(o(),P(B(n.root?"AngleDownIcon":"AngleRightIcon"),b({key:1,class:t.cx("submenuIcon")},{ref_for:!0},a.getPTOptions(r,u,"submenuIcon")),null,16,["class"]))],64)):w("",!0)],16,ut)),[[f]])],16,ot),a.isItemVisible(r)&&a.isItemGroup(r)?(o(),P(d,{key:0,id:a.getItemId(r)+"_list",menuId:n.menuId,role:"menu",style:Be(t.sx("submenu",!0,{processedItem:r})),focusedItemId:n.focusedItemId,items:r.items,mobileActive:n.mobileActive,activeItemPath:n.activeItemPath,templates:n.templates,level:n.level+1,"aria-labelledby":a.getItemLabelId(r),pt:t.pt,unstyled:t.unstyled,onItemClick:e[0]||(e[0]=function(m){return t.$emit("item-click",m)}),onItemMouseenter:e[1]||(e[1]=function(m){return t.$emit("item-mouseenter",m)}),onItemMousemove:e[2]||(e[2]=function(m){return t.$emit("item-mousemove",m)})},null,8,["id","menuId","style","focusedItemId","items","mobileActive","activeItemPath","templates","level","aria-labelledby","pt","unstyled"])):w("",!0)],16,st)):w("",!0),a.isItemVisible(r)&&a.getItemProp(r,"separator")?(o(),p("li",b({key:1,id:a.getItemId(r),class:[t.cx("separator"),a.getItemProp(r,"class")],style:a.getItemProp(r,"style"),role:"separator"},{ref_for:!0},t.ptm("separator")),null,16,dt)):w("",!0)],64)}),128))],16)}Le.render=mt;var Pe={name:"Menubar",extends:rt,inheritAttrs:!1,emits:["focus","blur"],matchMediaListener:null,data:function(){return{mobileActive:!1,focused:!1,focusedItemInfo:{index:-1,level:0,parentKey:""},activeItemPath:[],dirty:!1,query:null,queryMatches:!1}},watch:{activeItemPath:function(e){_(e)?(this.bindOutsideClickListener(),this.bindResizeListener()):(this.unbindOutsideClickListener(),this.unbindResizeListener())}},outsideClickListener:null,container:null,menubar:null,mounted:function(){this.bindMatchMediaListener()},beforeUnmount:function(){this.mobileActive=!1,this.unbindOutsideClickListener(),this.unbindResizeListener(),this.unbindMatchMediaListener(),this.container&&U.clear(this.container),this.container=null},methods:{getItemProp:function(e,n){return e?te(e[n]):void 0},getItemLabel:function(e){return this.getItemProp(e,"label")},isItemDisabled:function(e){return this.getItemProp(e,"disabled")},isItemVisible:function(e){return this.getItemProp(e,"visible")!==!1},isItemGroup:function(e){return _(this.getItemProp(e,"items"))},isItemSeparator:function(e){return this.getItemProp(e,"separator")},getProccessedItemLabel:function(e){return e?this.getItemLabel(e.item):void 0},isProccessedItemGroup:function(e){return e&&_(e.items)},toggle:function(e){var n=this;this.mobileActive?(this.mobileActive=!1,U.clear(this.menubar),this.hide()):(this.mobileActive=!0,U.set("menu",this.menubar,this.$primevue.config.zIndex.menu),setTimeout(function(){n.show()},1)),this.bindOutsideClickListener(),e.preventDefault()},show:function(){K(this.menubar)},hide:function(e,n){var i=this;this.mobileActive&&(this.mobileActive=!1,setTimeout(function(){K(i.$refs.menubutton)},0)),this.activeItemPath=[],this.focusedItemInfo={index:-1,level:0,parentKey:""},n&&K(this.menubar),this.dirty=!1},onFocus:function(e){this.focused=!0,this.focusedItemInfo=this.focusedItemInfo.index!==-1?this.focusedItemInfo:{index:this.findFirstFocusedItemIndex(),level:0,parentKey:""},this.$emit("focus",e)},onBlur:function(e){this.focused=!1,this.focusedItemInfo={index:-1,level:0,parentKey:""},this.searchValue="",this.dirty=!1,this.$emit("blur",e)},onKeyDown:function(e){var n=e.metaKey||e.ctrlKey;switch(e.code){case"ArrowDown":this.onArrowDownKey(e);break;case"ArrowUp":this.onArrowUpKey(e);break;case"ArrowLeft":this.onArrowLeftKey(e);break;case"ArrowRight":this.onArrowRightKey(e);break;case"Home":this.onHomeKey(e);break;case"End":this.onEndKey(e);break;case"Space":this.onSpaceKey(e);break;case"Enter":case"NumpadEnter":this.onEnterKey(e);break;case"Escape":this.onEscapeKey(e);break;case"Tab":this.onTabKey(e);break;case"PageDown":case"PageUp":case"Backspace":case"ShiftLeft":case"ShiftRight":break;default:!n&&_e(e.key)&&this.searchItems(e,e.key);break}},onItemChange:function(e,n){var i=e.processedItem,s=e.isFocus;if(!q(i)){var a=i.index,d=i.key,f=i.level,r=i.parentKey,u=i.items,m=_(u),I=this.activeItemPath.filter(function(c){return c.parentKey!==r&&c.parentKey!==d});m&&I.push(i),this.focusedItemInfo={index:a,level:f,parentKey:r},m&&(this.dirty=!0),s&&K(this.menubar),!(n==="hover"&&this.queryMatches)&&(this.activeItemPath=I)}},onItemClick:function(e){var n=e.originalEvent,i=e.processedItem,s=this.isProccessedItemGroup(i),a=q(i.parent),d=this.isSelected(i);if(d){var f=i.index,r=i.key,u=i.level,m=i.parentKey;this.activeItemPath=this.activeItemPath.filter(function(c){return r!==c.key&&r.startsWith(c.key)}),this.focusedItemInfo={index:f,level:u,parentKey:m},this.dirty=!a,K(this.menubar)}else if(s)this.onItemChange(e);else{var I=a?i:this.activeItemPath.find(function(c){return c.parentKey===""});this.hide(n),this.changeFocusedItemIndex(n,I?I.index:-1),this.mobileActive=!1,K(this.menubar)}},onItemMouseEnter:function(e){this.dirty&&this.onItemChange(e,"hover")},onItemMouseMove:function(e){this.focused&&this.changeFocusedItemIndex(e,e.processedItem.index)},menuButtonClick:function(e){this.toggle(e)},menuButtonKeydown:function(e){(e.code==="Enter"||e.code==="NumpadEnter"||e.code==="Space")&&this.menuButtonClick(e)},onArrowDownKey:function(e){var n=this.visibleItems[this.focusedItemInfo.index],i=n?q(n.parent):null;if(i){var s=this.isProccessedItemGroup(n);s&&(this.onItemChange({originalEvent:e,processedItem:n}),this.focusedItemInfo={index:-1,parentKey:n.key},this.onArrowRightKey(e))}else{var a=this.focusedItemInfo.index!==-1?this.findNextItemIndex(this.focusedItemInfo.index):this.findFirstFocusedItemIndex();this.changeFocusedItemIndex(e,a)}e.preventDefault()},onArrowUpKey:function(e){var n=this,i=this.visibleItems[this.focusedItemInfo.index],s=q(i.parent);if(s){var a=this.isProccessedItemGroup(i);if(a){this.onItemChange({originalEvent:e,processedItem:i}),this.focusedItemInfo={index:-1,parentKey:i.key};var d=this.findLastItemIndex();this.changeFocusedItemIndex(e,d)}}else{var f=this.activeItemPath.find(function(u){return u.key===i.parentKey});if(this.focusedItemInfo.index===0)this.focusedItemInfo={index:-1,parentKey:f?f.parentKey:""},this.searchValue="",this.onArrowLeftKey(e),this.activeItemPath=this.activeItemPath.filter(function(u){return u.parentKey!==n.focusedItemInfo.parentKey});else{var r=this.focusedItemInfo.index!==-1?this.findPrevItemIndex(this.focusedItemInfo.index):this.findLastFocusedItemIndex();this.changeFocusedItemIndex(e,r)}}e.preventDefault()},onArrowLeftKey:function(e){var n=this,i=this.visibleItems[this.focusedItemInfo.index],s=i?this.activeItemPath.find(function(d){return d.key===i.parentKey}):null;if(s)this.onItemChange({originalEvent:e,processedItem:s}),this.activeItemPath=this.activeItemPath.filter(function(d){return d.parentKey!==n.focusedItemInfo.parentKey}),e.preventDefault();else{var a=this.focusedItemInfo.index!==-1?this.findPrevItemIndex(this.focusedItemInfo.index):this.findLastFocusedItemIndex();this.changeFocusedItemIndex(e,a),e.preventDefault()}},onArrowRightKey:function(e){var n=this.visibleItems[this.focusedItemInfo.index],i=n?this.activeItemPath.find(function(d){return d.key===n.parentKey}):null;if(i){var s=this.isProccessedItemGroup(n);s&&(this.onItemChange({originalEvent:e,processedItem:n}),this.focusedItemInfo={index:-1,parentKey:n.key},this.onArrowDownKey(e))}else{var a=this.focusedItemInfo.index!==-1?this.findNextItemIndex(this.focusedItemInfo.index):this.findFirstFocusedItemIndex();this.changeFocusedItemIndex(e,a),e.preventDefault()}},onHomeKey:function(e){this.changeFocusedItemIndex(e,this.findFirstItemIndex()),e.preventDefault()},onEndKey:function(e){this.changeFocusedItemIndex(e,this.findLastItemIndex()),e.preventDefault()},onEnterKey:function(e){if(this.focusedItemInfo.index!==-1){var n=H(this.menubar,'li[id="'.concat("".concat(this.focusedItemId),'"]')),i=n&&H(n,'a[data-pc-section="itemlink"]');i?i.click():n&&n.click();var s=this.visibleItems[this.focusedItemInfo.index],a=this.isProccessedItemGroup(s);!a&&(this.focusedItemInfo.index=this.findFirstFocusedItemIndex())}e.preventDefault()},onSpaceKey:function(e){this.onEnterKey(e)},onEscapeKey:function(e){if(this.focusedItemInfo.level!==0){var n=this.focusedItemInfo;this.hide(e,!1),this.focusedItemInfo={index:Number(n.parentKey.split("_")[0]),level:0,parentKey:""}}e.preventDefault()},onTabKey:function(e){if(this.focusedItemInfo.index!==-1){var n=this.visibleItems[this.focusedItemInfo.index],i=this.isProccessedItemGroup(n);!i&&this.onItemChange({originalEvent:e,processedItem:n})}this.hide()},bindOutsideClickListener:function(){var e=this;this.outsideClickListener||(this.outsideClickListener=function(n){var i=e.container&&!e.container.contains(n.target),s=!(e.target&&(e.target===n.target||e.target.contains(n.target)));i&&s&&e.hide()},document.addEventListener("click",this.outsideClickListener,!0))},unbindOutsideClickListener:function(){this.outsideClickListener&&(document.removeEventListener("click",this.outsideClickListener,!0),this.outsideClickListener=null)},bindResizeListener:function(){var e=this;this.resizeListener||(this.resizeListener=function(n){ye()||e.hide(n,!0),e.mobileActive=!1},window.addEventListener("resize",this.resizeListener))},unbindResizeListener:function(){this.resizeListener&&(window.removeEventListener("resize",this.resizeListener),this.resizeListener=null)},bindMatchMediaListener:function(){var e=this;if(!this.matchMediaListener){var n=matchMedia("(max-width: ".concat(this.breakpoint,")"));this.query=n,this.queryMatches=n.matches,this.matchMediaListener=function(){e.queryMatches=n.matches,e.mobileActive=!1},this.query.addEventListener("change",this.matchMediaListener)}},unbindMatchMediaListener:function(){this.matchMediaListener&&(this.query.removeEventListener("change",this.matchMediaListener),this.matchMediaListener=null)},isItemMatched:function(e){var n;return this.isValidItem(e)&&((n=this.getProccessedItemLabel(e))===null||n===void 0?void 0:n.toLocaleLowerCase().startsWith(this.searchValue.toLocaleLowerCase()))},isValidItem:function(e){return!!e&&!this.isItemDisabled(e.item)&&!this.isItemSeparator(e.item)&&this.isItemVisible(e.item)},isValidSelectedItem:function(e){return this.isValidItem(e)&&this.isSelected(e)},isSelected:function(e){return this.activeItemPath.some(function(n){return n.key===e.key})},findFirstItemIndex:function(){var e=this;return this.visibleItems.findIndex(function(n){return e.isValidItem(n)})},findLastItemIndex:function(){var e=this;return le(this.visibleItems,function(n){return e.isValidItem(n)})},findNextItemIndex:function(e){var n=this,i=e<this.visibleItems.length-1?this.visibleItems.slice(e+1).findIndex(function(s){return n.isValidItem(s)}):-1;return i>-1?i+e+1:e},findPrevItemIndex:function(e){var n=this,i=e>0?le(this.visibleItems.slice(0,e),function(s){return n.isValidItem(s)}):-1;return i>-1?i:e},findSelectedItemIndex:function(){var e=this;return this.visibleItems.findIndex(function(n){return e.isValidSelectedItem(n)})},findFirstFocusedItemIndex:function(){var e=this.findSelectedItemIndex();return e<0?this.findFirstItemIndex():e},findLastFocusedItemIndex:function(){var e=this.findSelectedItemIndex();return e<0?this.findLastItemIndex():e},searchItems:function(e,n){var i=this;this.searchValue=(this.searchValue||"")+n;var s=-1,a=!1;return this.focusedItemInfo.index!==-1?(s=this.visibleItems.slice(this.focusedItemInfo.index).findIndex(function(d){return i.isItemMatched(d)}),s=s===-1?this.visibleItems.slice(0,this.focusedItemInfo.index).findIndex(function(d){return i.isItemMatched(d)}):s+this.focusedItemInfo.index):s=this.visibleItems.findIndex(function(d){return i.isItemMatched(d)}),s!==-1&&(a=!0),s===-1&&this.focusedItemInfo.index===-1&&(s=this.findFirstFocusedItemIndex()),s!==-1&&this.changeFocusedItemIndex(e,s),this.searchTimeout&&clearTimeout(this.searchTimeout),this.searchTimeout=setTimeout(function(){i.searchValue="",i.searchTimeout=null},500),a},changeFocusedItemIndex:function(e,n){this.focusedItemInfo.index!==n&&(this.focusedItemInfo.index=n,this.scrollInView())},scrollInView:function(){var e=arguments.length>0&&arguments[0]!==void 0?arguments[0]:-1,n=e!==-1?"".concat(this.$id,"_").concat(e):this.focusedItemId,i=H(this.menubar,'li[id="'.concat(n,'"]'));i&&i.scrollIntoView&&i.scrollIntoView({block:"nearest",inline:"start"})},createProcessedItems:function(e){var n=this,i=arguments.length>1&&arguments[1]!==void 0?arguments[1]:0,s=arguments.length>2&&arguments[2]!==void 0?arguments[2]:{},a=arguments.length>3&&arguments[3]!==void 0?arguments[3]:"",d=[];return e&&e.forEach(function(f,r){var u=(a!==""?a+"_":"")+r,m={item:f,index:r,level:i,key:u,parent:s,parentKey:a};m.items=n.createProcessedItems(f.items,i+1,m,u),d.push(m)}),d},containerRef:function(e){this.container=e},menubarRef:function(e){this.menubar=e?e.$el:void 0}},computed:{processedItems:function(){return this.createProcessedItems(this.model||[])},visibleItems:function(){var e=this,n=this.activeItemPath.find(function(i){return i.key===e.focusedItemInfo.parentKey});return n?n.items:this.processedItems},focusedItemId:function(){return this.focusedItemInfo.index!==-1?"".concat(this.$id).concat(_(this.focusedItemInfo.parentKey)?"_"+this.focusedItemInfo.parentKey:"","_").concat(this.focusedItemInfo.index):null}},components:{MenubarSub:Le,BarsIcon:Te}};function G(t){"@babel/helpers - typeof";return G=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(e){return typeof e}:function(e){return e&&typeof Symbol=="function"&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},G(t)}function he(t,e){var n=Object.keys(t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(t);e&&(i=i.filter(function(s){return Object.getOwnPropertyDescriptor(t,s).enumerable})),n.push.apply(n,i)}return n}function pe(t){for(var e=1;e<arguments.length;e++){var n=arguments[e]!=null?arguments[e]:{};e%2?he(Object(n),!0).forEach(function(i){ct(t,i,n[i])}):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(n)):he(Object(n)).forEach(function(i){Object.defineProperty(t,i,Object.getOwnPropertyDescriptor(n,i))})}return t}function ct(t,e,n){return(e=bt(e))in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}function bt(t){var e=ft(t,"string");return G(e)=="symbol"?e:e+""}function ft(t,e){if(G(t)!="object"||!t)return t;var n=t[Symbol.toPrimitive];if(n!==void 0){var i=n.call(t,e);if(G(i)!="object")return i;throw new TypeError("@@toPrimitive must return a primitive value.")}return(e==="string"?String:Number)(t)}var ht=["aria-haspopup","aria-expanded","aria-controls","aria-label"];function pt(t,e,n,i,s,a){var d=A("BarsIcon"),f=A("MenubarSub");return o(),p("div",b({ref:a.containerRef,class:t.cx("root")},t.ptmi("root")),[t.$slots.start?(o(),p("div",b({key:0,class:t.cx("start")},t.ptm("start")),[T(t.$slots,"start")],16)):w("",!0),T(t.$slots,t.$slots.button?"button":"menubutton",{id:t.$id,class:j(t.cx("button")),toggleCallback:function(u){return a.menuButtonClick(u)}},function(){var r;return[t.model&&t.model.length>0?(o(),p("a",b({key:0,ref:"menubutton",role:"button",tabindex:"0",class:t.cx("button"),"aria-haspopup":!!(t.model.length&&t.model.length>0),"aria-expanded":s.mobileActive,"aria-controls":t.$id,"aria-label":(r=t.$primevue.config.locale.aria)===null||r===void 0?void 0:r.navigation,onClick:e[0]||(e[0]=function(u){return a.menuButtonClick(u)}),onKeydown:e[1]||(e[1]=function(u){return a.menuButtonKeydown(u)})},pe(pe({},t.buttonProps),t.ptm("button"))),[T(t.$slots,t.$slots.buttonicon?"buttonicon":"menubuttonicon",{},function(){return[k(d,Ue(je(t.ptm("buttonicon"))),null,16)]})],16,ht)):w("",!0)]}),k(f,{ref:a.menubarRef,id:t.$id+"_list",role:"menubar",items:a.processedItems,templates:t.$slots,root:!0,mobileActive:s.mobileActive,tabindex:"0","aria-activedescendant":s.focused?a.focusedItemId:void 0,menuId:t.$id,focusedItemId:s.focused?a.focusedItemId:void 0,activeItemPath:s.activeItemPath,level:0,"aria-labelledby":t.ariaLabelledby,"aria-label":t.ariaLabel,pt:t.pt,unstyled:t.unstyled,onFocus:a.onFocus,onBlur:a.onBlur,onKeydown:a.onKeyDown,onItemClick:a.onItemClick,onItemMouseenter:a.onItemMouseEnter,onItemMousemove:a.onItemMouseMove},null,8,["id","items","templates","mobileActive","aria-activedescendant","menuId","focusedItemId","activeItemPath","aria-labelledby","aria-label","pt","unstyled","onFocus","onBlur","onKeydown","onItemClick","onItemMouseenter","onItemMousemove"]),t.$slots.end?(o(),p("div",b({key:1,class:t.cx("end")},t.ptm("end")),[T(t.$slots,"end")],16)):w("",!0)],16)}Pe.render=pt;var It=`
    .p-menu {
        background: dt('menu.background');
        color: dt('menu.color');
        border: 1px solid dt('menu.border.color');
        border-radius: dt('menu.border.radius');
        min-width: 12.5rem;
    }

    .p-menu-list {
        margin: 0;
        padding: dt('menu.list.padding');
        outline: 0 none;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: dt('menu.list.gap');
    }

    .p-menu-item-content {
        transition:
            background dt('menu.transition.duration'),
            color dt('menu.transition.duration');
        border-radius: dt('menu.item.border.radius');
        color: dt('menu.item.color');
        overflow: hidden;
    }

    .p-menu-item-link {
        cursor: pointer;
        display: flex;
        align-items: center;
        text-decoration: none;
        overflow: hidden;
        position: relative;
        color: inherit;
        padding: dt('menu.item.padding');
        gap: dt('menu.item.gap');
        user-select: none;
        outline: 0 none;
    }

    .p-menu-item-label {
        line-height: 1;
    }

    .p-menu-item-icon {
        color: dt('menu.item.icon.color');
    }

    .p-menu-item.p-focus .p-menu-item-content {
        color: dt('menu.item.focus.color');
        background: dt('menu.item.focus.background');
    }

    .p-menu-item.p-focus .p-menu-item-icon {
        color: dt('menu.item.icon.focus.color');
    }

    .p-menu-item:not(.p-disabled) .p-menu-item-content:hover {
        color: dt('menu.item.focus.color');
        background: dt('menu.item.focus.background');
    }

    .p-menu-item:not(.p-disabled) .p-menu-item-content:hover .p-menu-item-icon {
        color: dt('menu.item.icon.focus.color');
    }

    .p-menu-overlay {
        box-shadow: dt('menu.shadow');
    }

    .p-menu-submenu-label {
        background: dt('menu.submenu.label.background');
        padding: dt('menu.submenu.label.padding');
        color: dt('menu.submenu.label.color');
        font-weight: dt('menu.submenu.label.font.weight');
    }

    .p-menu-separator {
        border-block-start: 1px solid dt('menu.separator.border.color');
    }
`,gt={root:function(e){var n=e.props;return["p-menu p-component",{"p-menu-overlay":n.popup}]},start:"p-menu-start",list:"p-menu-list",submenuLabel:"p-menu-submenu-label",separator:"p-menu-separator",end:"p-menu-end",item:function(e){var n=e.instance;return["p-menu-item",{"p-focus":n.id===n.focusedOptionId,"p-disabled":n.disabled()}]},itemContent:"p-menu-item-content",itemLink:"p-menu-item-link",itemIcon:"p-menu-item-icon",itemLabel:"p-menu-item-label"},vt=ge.extend({name:"menu",style:It,classes:gt}),yt={name:"BaseMenu",extends:J,props:{popup:{type:Boolean,default:!1},model:{type:Array,default:null},appendTo:{type:[String,Object],default:"body"},autoZIndex:{type:Boolean,default:!0},baseZIndex:{type:Number,default:0},tabindex:{type:Number,default:0},ariaLabel:{type:String,default:null},ariaLabelledby:{type:String,default:null}},style:vt,provide:function(){return{$pcMenu:this,$parentInstance:this}}},xe={name:"Menuitem",hostName:"Menu",extends:J,inheritAttrs:!1,emits:["item-click","item-mousemove"],props:{item:null,templates:null,id:null,focusedOptionId:null,index:null},methods:{getItemProp:function(e,n){return e&&e.item?te(e.item[n]):void 0},getPTOptions:function(e){return this.ptm(e,{context:{item:this.item,index:this.index,focused:this.isItemFocused(),disabled:this.disabled()}})},isItemFocused:function(){return this.focusedOptionId===this.id},onItemClick:function(e){var n=this.getItemProp(this.item,"command");n&&n({originalEvent:e,item:this.item.item}),this.$emit("item-click",{originalEvent:e,item:this.item,id:this.id})},onItemMouseMove:function(e){this.$emit("item-mousemove",{originalEvent:e,item:this.item,id:this.id})},visible:function(){return typeof this.item.visible=="function"?this.item.visible():this.item.visible!==!1},disabled:function(){return typeof this.item.disabled=="function"?this.item.disabled():this.item.disabled},label:function(){return typeof this.item.label=="function"?this.item.label():this.item.label},getMenuItemProps:function(e){return{action:b({class:this.cx("itemLink"),tabindex:"-1"},this.getPTOptions("itemLink")),icon:b({class:[this.cx("itemIcon"),e.icon]},this.getPTOptions("itemIcon")),label:b({class:this.cx("itemLabel")},this.getPTOptions("itemLabel"))}}},computed:{dataP:function(){return we({focus:this.isItemFocused(),disabled:this.disabled()})}},directives:{ripple:ve}},wt=["id","aria-label","aria-disabled","data-p-focused","data-p-disabled","data-p"],kt=["data-p"],Lt=["href","target"],Pt=["data-p"],xt=["data-p"];function Mt(t,e,n,i,s,a){var d=ne("ripple");return a.visible()?(o(),p("li",b({key:0,id:n.id,class:[t.cx("item"),n.item.class],role:"menuitem",style:n.item.style,"aria-label":a.label(),"aria-disabled":a.disabled(),"data-p-focused":a.isItemFocused(),"data-p-disabled":a.disabled()||!1,"data-p":a.dataP},a.getPTOptions("item")),[h("div",b({class:t.cx("itemContent"),onClick:e[0]||(e[0]=function(f){return a.onItemClick(f)}),onMousemove:e[1]||(e[1]=function(f){return a.onItemMouseMove(f)}),"data-p":a.dataP},a.getPTOptions("itemContent")),[n.templates.item?n.templates.item?(o(),P(B(n.templates.item),{key:1,item:n.item,label:a.label(),props:a.getMenuItemProps(n.item)},null,8,["item","label","props"])):w("",!0):W((o(),p("a",b({key:0,href:n.item.url,class:t.cx("itemLink"),target:n.item.target,tabindex:"-1"},a.getPTOptions("itemLink")),[n.templates.itemicon?(o(),P(B(n.templates.itemicon),{key:0,item:n.item,class:j(t.cx("itemIcon"))},null,8,["item","class"])):n.item.icon?(o(),p("span",b({key:1,class:[t.cx("itemIcon"),n.item.icon],"data-p":a.dataP},a.getPTOptions("itemIcon")),null,16,Pt)):w("",!0),h("span",b({class:t.cx("itemLabel"),"data-p":a.dataP},a.getPTOptions("itemLabel")),S(a.label()),17,xt)],16,Lt)),[[d]])],16,kt)],16,wt)):w("",!0)}xe.render=Mt;function Ie(t){return Kt(t)||St(t)||Ot(t)||Ct()}function Ct(){throw new TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function Ot(t,e){if(t){if(typeof t=="string")return ee(t,e);var n={}.toString.call(t).slice(8,-1);return n==="Object"&&t.constructor&&(n=t.constructor.name),n==="Map"||n==="Set"?Array.from(t):n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?ee(t,e):void 0}}function St(t){if(typeof Symbol<"u"&&t[Symbol.iterator]!=null||t["@@iterator"]!=null)return Array.from(t)}function Kt(t){if(Array.isArray(t))return ee(t)}function ee(t,e){(e==null||e>t.length)&&(e=t.length);for(var n=0,i=Array(e);n<e;n++)i[n]=t[n];return i}var Me={name:"Menu",extends:yt,inheritAttrs:!1,emits:["show","hide","focus","blur"],data:function(){return{overlayVisible:!1,focused:!1,focusedOptionIndex:-1,selectedOptionIndex:-1}},target:null,outsideClickListener:null,scrollHandler:null,resizeListener:null,container:null,list:null,mounted:function(){this.popup||(this.bindResizeListener(),this.bindOutsideClickListener())},beforeUnmount:function(){this.unbindResizeListener(),this.unbindOutsideClickListener(),this.scrollHandler&&(this.scrollHandler.destroy(),this.scrollHandler=null),this.target=null,this.container&&this.autoZIndex&&U.clear(this.container),this.container=null},methods:{itemClick:function(e){var n=e.item;this.disabled(n)||(n.command&&n.command(e),this.overlayVisible&&this.hide(),!this.popup&&this.focusedOptionIndex!==e.id&&(this.focusedOptionIndex=e.id))},itemMouseMove:function(e){this.focused&&(this.focusedOptionIndex=e.id)},onListFocus:function(e){this.focused=!0,!this.popup&&this.changeFocusedOptionIndex(0),this.$emit("focus",e)},onListBlur:function(e){this.focused=!1,this.focusedOptionIndex=-1,this.$emit("blur",e)},onListKeyDown:function(e){switch(e.code){case"ArrowDown":this.onArrowDownKey(e);break;case"ArrowUp":this.onArrowUpKey(e);break;case"Home":this.onHomeKey(e);break;case"End":this.onEndKey(e);break;case"Enter":case"NumpadEnter":this.onEnterKey(e);break;case"Space":this.onSpaceKey(e);break;case"Escape":this.popup&&(K(this.target),this.hide());case"Tab":this.overlayVisible&&this.hide();break}},onArrowDownKey:function(e){var n=this.findNextOptionIndex(this.focusedOptionIndex);this.changeFocusedOptionIndex(n),e.preventDefault()},onArrowUpKey:function(e){if(e.altKey&&this.popup)K(this.target),this.hide(),e.preventDefault();else{var n=this.findPrevOptionIndex(this.focusedOptionIndex);this.changeFocusedOptionIndex(n),e.preventDefault()}},onHomeKey:function(e){this.changeFocusedOptionIndex(0),e.preventDefault()},onEndKey:function(e){this.changeFocusedOptionIndex(Z(this.container,'li[data-pc-section="item"][data-p-disabled="false"]').length-1),e.preventDefault()},onEnterKey:function(e){var n=H(this.list,'li[id="'.concat("".concat(this.focusedOptionIndex),'"]')),i=n&&H(n,'a[data-pc-section="itemlink"]');this.popup&&K(this.target),i?i.click():n&&n.click(),e.preventDefault()},onSpaceKey:function(e){this.onEnterKey(e)},findNextOptionIndex:function(e){var n=Z(this.container,'li[data-pc-section="item"][data-p-disabled="false"]'),i=Ie(n).findIndex(function(s){return s.id===e});return i>-1?i+1:0},findPrevOptionIndex:function(e){var n=Z(this.container,'li[data-pc-section="item"][data-p-disabled="false"]'),i=Ie(n).findIndex(function(s){return s.id===e});return i>-1?i-1:0},changeFocusedOptionIndex:function(e){var n=Z(this.container,'li[data-pc-section="item"][data-p-disabled="false"]'),i=e>=n.length?n.length-1:e<0?0:e;i>-1&&(this.focusedOptionIndex=n[i].getAttribute("id"))},toggle:function(e,n){this.overlayVisible?this.hide():this.show(e,n)},show:function(e,n){this.overlayVisible=!0,this.target=n??e.currentTarget},hide:function(){this.overlayVisible=!1,this.target=null},onEnter:function(e){We(e,{position:"absolute",top:"0"}),this.alignOverlay(),this.bindOutsideClickListener(),this.bindResizeListener(),this.bindScrollListener(),this.autoZIndex&&U.set("menu",e,this.baseZIndex+this.$primevue.config.zIndex.menu),this.popup&&K(this.list),this.$emit("show")},onLeave:function(){this.unbindOutsideClickListener(),this.unbindResizeListener(),this.unbindScrollListener(),this.$emit("hide")},onAfterLeave:function(e){this.autoZIndex&&U.clear(e)},alignOverlay:function(){Ze(this.container,this.target);var e=Y(this.target);e>Y(this.container)&&(this.container.style.minWidth=Y(this.target)+"px")},bindOutsideClickListener:function(){var e=this;this.outsideClickListener||(this.outsideClickListener=function(n){var i=e.container&&!e.container.contains(n.target),s=!(e.target&&(e.target===n.target||e.target.contains(n.target)));e.overlayVisible&&i&&s?e.hide():!e.popup&&i&&s&&(e.focusedOptionIndex=-1)},document.addEventListener("click",this.outsideClickListener,!0))},unbindOutsideClickListener:function(){this.outsideClickListener&&(document.removeEventListener("click",this.outsideClickListener,!0),this.outsideClickListener=null)},bindScrollListener:function(){var e=this;this.scrollHandler||(this.scrollHandler=new qe(this.target,function(){e.overlayVisible&&e.hide()})),this.scrollHandler.bindScrollListener()},unbindScrollListener:function(){this.scrollHandler&&this.scrollHandler.unbindScrollListener()},bindResizeListener:function(){var e=this;this.resizeListener||(this.resizeListener=function(){e.overlayVisible&&!ye()&&e.hide()},window.addEventListener("resize",this.resizeListener))},unbindResizeListener:function(){this.resizeListener&&(window.removeEventListener("resize",this.resizeListener),this.resizeListener=null)},visible:function(e){return typeof e.visible=="function"?e.visible():e.visible!==!1},disabled:function(e){return typeof e.disabled=="function"?e.disabled():e.disabled},label:function(e){return typeof e.label=="function"?e.label():e.label},onOverlayClick:function(e){Ge.emit("overlay-click",{originalEvent:e,target:this.target})},containerRef:function(e){this.container=e},listRef:function(e){this.list=e}},computed:{focusedOptionId:function(){return this.focusedOptionIndex!==-1?this.focusedOptionIndex:null},dataP:function(){return we({popup:this.popup})}},components:{PVMenuitem:xe,Portal:He}},At=["id","data-p"],Dt=["id","tabindex","aria-activedescendant","aria-label","aria-labelledby"],Ft=["id"];function Et(t,e,n,i,s,a){var d=A("PVMenuitem"),f=A("Portal");return o(),P(f,{appendTo:t.appendTo,disabled:!t.popup},{default:O(function(){return[k(Je,b({name:"p-anchored-overlay",onEnter:a.onEnter,onLeave:a.onLeave,onAfterLeave:a.onAfterLeave},t.ptm("transition")),{default:O(function(){return[!t.popup||s.overlayVisible?(o(),p("div",b({key:0,ref:a.containerRef,id:t.$id,class:t.cx("root"),onClick:e[3]||(e[3]=function(){return a.onOverlayClick&&a.onOverlayClick.apply(a,arguments)}),"data-p":a.dataP},t.ptmi("root")),[t.$slots.start?(o(),p("div",b({key:0,class:t.cx("start")},t.ptm("start")),[T(t.$slots,"start")],16)):w("",!0),h("ul",b({ref:a.listRef,id:t.$id+"_list",class:t.cx("list"),role:"menu",tabindex:t.tabindex,"aria-activedescendant":s.focused?a.focusedOptionId:void 0,"aria-label":t.ariaLabel,"aria-labelledby":t.ariaLabelledby,onFocus:e[0]||(e[0]=function(){return a.onListFocus&&a.onListFocus.apply(a,arguments)}),onBlur:e[1]||(e[1]=function(){return a.onListBlur&&a.onListBlur.apply(a,arguments)}),onKeydown:e[2]||(e[2]=function(){return a.onListKeyDown&&a.onListKeyDown.apply(a,arguments)})},t.ptm("list")),[(o(!0),p(E,null,$(t.model,function(r,u){return o(),p(E,{key:a.label(r)+u.toString()},[r.items&&a.visible(r)&&!r.separator?(o(),p(E,{key:0},[r.items?(o(),p("li",b({key:0,id:t.$id+"_"+u,class:[t.cx("submenuLabel"),r.class],role:"none"},{ref_for:!0},t.ptm("submenuLabel")),[T(t.$slots,t.$slots.submenulabel?"submenulabel":"submenuheader",{item:r},function(){return[ke(S(a.label(r)),1)]})],16,Ft)):w("",!0),(o(!0),p(E,null,$(r.items,function(m,I){return o(),p(E,{key:m.label+u+"_"+I},[a.visible(m)&&!m.separator?(o(),P(d,{key:0,id:t.$id+"_"+u+"_"+I,item:m,templates:t.$slots,focusedOptionId:a.focusedOptionId,unstyled:t.unstyled,onItemClick:a.itemClick,onItemMousemove:a.itemMouseMove,pt:t.pt},null,8,["id","item","templates","focusedOptionId","unstyled","onItemClick","onItemMousemove","pt"])):a.visible(m)&&m.separator?(o(),p("li",b({key:"separator"+u+I,class:[t.cx("separator"),r.class],style:m.style,role:"separator"},{ref_for:!0},t.ptm("separator")),null,16)):w("",!0)],64)}),128))],64)):a.visible(r)&&r.separator?(o(),p("li",b({key:"separator"+u.toString(),class:[t.cx("separator"),r.class],style:r.style,role:"separator"},{ref_for:!0},t.ptm("separator")),null,16)):(o(),P(d,{key:a.label(r)+u.toString(),id:t.$id+"_"+u,item:r,index:u,templates:t.$slots,focusedOptionId:a.focusedOptionId,unstyled:t.unstyled,onItemClick:a.itemClick,onItemMousemove:a.itemMouseMove,pt:t.pt},null,8,["id","item","index","templates","focusedOptionId","unstyled","onItemClick","onItemMousemove","pt"]))],64)}),128))],16,Dt),t.$slots.end?(o(),p("div",b({key:1,class:t.cx("end")},t.ptm("end")),[T(t.$slots,"end")],16)):w("",!0)],16,At)):w("",!0)]}),_:3},16,["onEnter","onLeave","onAfterLeave"])]}),_:3},8,["appendTo","disabled"])}Me.render=Et;const Vt={__name:"IntegramMain",setup(t,{expose:e}){e();const n=de(),i=me(),s=ce(),a=x(),d=x(null),f=x(!1),r=x(!1),u=x(!1),m=x(""),I=x("info"),c=x(""),z=x(""),R=x(""),D=x("ru"),Ce=x("1.0.0"),F=N(()=>{const l=i.params.database||y.currentDatabase||y.getDatabase()||"my";return console.log("[IntegramMain] database computed:",l,"route.params:",i.params),l}),Oe=N(()=>y.getAuthInfo().userName||"User"),Se=N(()=>{const l=i.path===`/integram/${F.value}/`||i.path===`/integram/${F.value}`;return f.value&&!l}),Ke=N(()=>{const l=[];for(const[v,L]of Object.entries(y.databases))l.push({value:v,label:v,icon:"pi pi-database",isPrimary:v==="my",isOwned:!1});const g=y.databases.my;if(g!=null&&g.ownedDatabases)for(const v of g.ownedDatabases)y.databases[v]||l.push({value:v,label:v,icon:"pi pi-th-large",isPrimary:!1,isOwned:!0});return l.sort((v,L)=>v.value==="my"?-1:L.value==="my"?1:v.value.localeCompare(L.value))}),ie=[{href:"dict",icon:"pi pi-database",ruName:"Объекты",enName:"Objects"},{href:"table",icon:"pi pi-table",ruName:"Таблицы",enName:"Tables"},{href:"edit_types",icon:"pi pi-sitemap",ruName:"Структура",enName:"Structure"},{href:"sql",icon:"pi pi-code",ruName:"SQL",enName:"SQL"},{href:"smartq",icon:"pi pi-search",ruName:"Умный запрос",enName:"Smart Query"},{href:"report",icon:"pi pi-chart-bar",ruName:"Запросы",enName:"Queries"},{href:"form",icon:"pi pi-file",ruName:"Формы",enName:"Forms"},{href:"myform",icon:"pi pi-sliders-h",ruName:"Мои формы",enName:"My Forms"},{href:"upload",icon:"pi pi-upload",ruName:"Загрузка",enName:"Upload"},{href:"dir_admin",icon:"pi pi-folder",ruName:"Файлы",enName:"Files"},{href:"info",icon:"pi pi-info-circle",ruName:"Информация",enName:"Info"}],Ae=N(()=>{const l=F.value;return console.log("[IntegramMain] menuItems computed, currentDB:",l),ie.map(g=>({label:D.value==="ru"?g.ruName:g.enName,icon:g.icon,command:()=>{const v=`/integram/${l}/${g.href}`;console.log("[IntegramMain] Menu item clicked:",g.ruName,"URL:",v,"currentDB:",l),n.push(v)}}))}),De=N(()=>[{label:C("help"),icon:"pi pi-question-circle",command:ae},{label:C("myAccount"),icon:"pi pi-user",command:()=>window.open(`/my?login=${F.value}`,"_blank")},{separator:!0},{label:"EN/RU",icon:"pi pi-globe",command:se},{label:C("changePassword"),icon:"pi pi-key",command:re},{separator:!0},{label:C("exit"),icon:"pi pi-sign-out",command:oe,class:"text-red-500"}]);function C(l){var v;return((v={ru:{help:"Помощь",myAccount:"ЛК / Счет",changePassword:"Сменить пароль",exit:"Выход",passwordChange:"Смена пароля",currentPassword:"Действующий пароль",newPassword:"Новый пароль",repeatPassword:"Повторите пароль",change:"Сменить",cancel:"Отменить",fillAllFields:"Заполните все поля",passwordsDoNotMatch:"Пароли не совпадают",passwordChanged:"Пароль успешно изменён",wrongPassword:"Неверный пароль",more:"Еще"},en:{help:"Help",myAccount:"My account",changePassword:"Change Password",exit:"Exit",passwordChange:"Password Change",currentPassword:"Current Password",newPassword:"New Password",repeatPassword:"Repeat Password",change:"Change",cancel:"Cancel",fillAllFields:"Please fill in all fields",passwordsDoNotMatch:"Passwords do not match",passwordChanged:"Password changed successfully",wrongPassword:"Wrong password",more:"More"}}[D.value])==null?void 0:v[l])||l}function Fe(l){a.value.toggle(l)}function ae(){n.push("/integram/api-docs")}function re(){r.value=!0,c.value="",z.value="",R.value="",m.value=""}async function Ee(){if(!c.value||!z.value||!R.value){m.value=C("fillAllFields"),I.value="error";return}if(z.value!==R.value){m.value=C("passwordsDoNotMatch"),I.value="error";return}u.value=!0,m.value="";try{const l=await y.post("auth?JSON",{change:1,login:y.getAuthInfo().userName,pwd:c.value,npw1:z.value,npw2:R.value});if(l.msg&&!l.msg.includes("[err"))m.value=C("passwordChanged"),I.value="success",l.token&&(y.token=l.token),l.xsrf&&(y.xsrfToken=l.xsrf),y.saveSession(),setTimeout(()=>{r.value=!1,c.value="",z.value="",R.value=""},2e3);else{const g=l.msg?l.msg.replace(/ ?\[.+\]/,""):C("wrongPassword");m.value=g,I.value="error"}}catch(l){m.value=l.message||C("wrongPassword"),I.value="error"}finally{u.value=!1}}function se(){D.value=D.value==="ru"?"en":"ru",localStorage.setItem("integram_locale",D.value),document.cookie=`${F.value}_locale=${D.value};Path=/`}async function Ve(l){const g=l.value,v=i.params.database;f.value=!0,s.add({severity:"info",summary:"Переключение БД",detail:`Переход на "${g}"...`,life:2e3});try{await y.switchDatabase(g);const L=`/integram/${g}/`;console.log("[handleDatabaseChange] Switching from",v,"to",g,"redirecting to:",L),await n.push(L),f.value=!1}catch(L){console.error("Failed to switch database:",L),s.add({severity:"error",summary:"Ошибка",detail:L.message,life:5e3}),d.value=v,f.value=!1}}function oe(){y.logout(),document.cookie=`${F.value}=;Path=/`,n.push("/integram/login")}be(()=>i.params.database,async l=>{if(l&&l!==d.value){d.value=l;try{await y.switchDatabase(l)}catch(g){console.warn("Failed to switch database from route change:",g)}}},{immediate:!0}),fe(async()=>{y.tryRestoreSession();const l=y.getAuthInfo();if(!l.token||!l.xsrf){const v="https://example.integram.io",L=F.value||"my",Q="d",Ne="d";try{console.log("[IntegramMain] Auto-authenticating with database:",L),await y.authenticate(v,L,Q,Ne);const M=await y.get(`/${L}/auth?JSON`);if(M.data){const V=y.databases[L];V&&(V.userName=M.data.login||Q,V.userRole=M.data.role||"user",V.authInfo={userName:M.data.login||Q,userRole:M.data.role||"user",token:V.token,xsrf:V.xsrfToken},M.data.bases&&Array.isArray(M.data.bases)&&(V.ownedDatabases=M.data.bases))}y.saveSession(),console.log("[IntegramMain] Auto-authentication successful")}catch(M){console.error("[IntegramMain] Auto-authentication failed:",M),s.add({severity:"error",summary:"Ошибка автоматической авторизации",detail:M.message||"Не удалось войти в систему",life:5e3});return}}try{await y.validateSession()}catch(v){console.warn("Session validation skipped:",v.message)}const g=localStorage.getItem("integram_locale");g?D.value=g.toLowerCase():(D.value="ru",localStorage.setItem("integram_locale","ru"))});const ue={router:n,route:i,toast:s,userMenu:a,selectedDatabase:d,switchingDatabase:f,passwordChangeVisible:r,passwordChanging:u,passwordMessage:m,passwordMessageSeverity:I,oldPassword:c,newPassword:z,newPasswordRepeat:R,locale:D,version:Ce,database:F,userName:Oe,shouldShowSwitchingOverlay:Se,availableDatabases:Ke,baseMenuItems:ie,menuItems:Ae,userMenuItems:De,t:C,toggleUserMenu:Fe,openHelp:ae,showPasswordChange:re,changePassword:Ee,toggleLocale:se,handleDatabaseChange:Ve,logout:oe,ref:x,computed:N,onMounted:fe,watch:be,get useRouter(){return de},get useRoute(){return me},get useToast(){return ce},get Menubar(){return Pe},get Menu(){return Me},get Dropdown(){return Ye},get Tag(){return Xe},get ProgressSpinner(){return $e},get integramApiClient(){return y},SafeRouterView:et};return Object.defineProperty(ue,"__isScriptSetup",{enumerable:!1,value:!0}),ue}},Nt={class:"integram-main"},Tt={class:"flex align-items-center gap-2"},zt={key:0,class:"flex align-items-center gap-2"},Rt={key:1},_t={class:"flex align-items-center gap-2"},Bt={key:0,class:"database-switch-overlay"},Ut={class:"switch-spinner-container"},jt={class:"p-fluid"},Ht={class:"field"},Gt={for:"old-pwd"},qt={class:"field"},Zt={for:"new-pwd"},Wt={class:"field"},Jt={for:"new-again"},Qt={class:"footer text-center py-3"},Yt={class:"text-muted"};function Xt(t,e,n,i,s,a){const d=A("router-link"),f=A("Button"),r=A("Message"),u=A("Password"),m=A("Dialog"),I=ne("tooltip");return o(),p("div",Nt,[k(i.Menubar,{model:i.menuItems,class:"integram-menubar"},{start:O(()=>[k(d,{to:`/integram/${i.database}`,class:"integram-brand flex align-items-center gap-2 mr-3 no-underline"},{default:O(()=>[...e[6]||(e[6]=[h("svg",{width:"32",height:"27",viewBox:"0 0 40 34",fill:"none",xmlns:"http://www.w3.org/2000/svg",class:"integram-logo"},[h("g",{"clip-path":"url(#clip0_integram)"},[h("path",{d:"M21.0983 12.4256L19.5194 14.1254L22.2153 17.0289L13.4346 26.3889L2.28812 22.7817V11.2779L13.4346 7.67068L15.452 9.87038L17.0454 8.19038L14.1005 5L0 9.56361V24.4959L14.1005 29.0595L25.3877 17.0289L21.0983 12.4256Z",fill:"currentColor"}),h("path",{d:"M15.4718 21.634L17.0489 19.9341L14.3548 17.0307L23.1356 7.67068L34.2802 11.2779V22.7817L23.1356 26.3889L21.1127 24.1838L19.5193 25.8656L22.4679 29.0595L36.5683 24.4977V9.56361L22.4679 5L11.1807 17.0307L15.4718 21.634Z",fill:"currentColor"})]),h("defs",null,[h("clipPath",{id:"clip0_integram"},[h("rect",{width:"36.6316",height:"24",fill:"white",transform:"translate(0 5)"})])])],-1)])]),_:1},8,["to"])]),end:O(()=>[h("div",Tt,[k(i.Dropdown,{modelValue:i.selectedDatabase,"onUpdate:modelValue":e[0]||(e[0]=c=>i.selectedDatabase=c),options:i.availableDatabases,optionLabel:"label",optionValue:"value",placeholder:"БД",onChange:i.handleDatabaseChange,class:"database-selector"},{value:O(c=>[c.value?(o(),p("div",zt,[e[7]||(e[7]=h("i",{class:"pi pi-database"},null,-1)),h("span",null,S(c.value),1)])):(o(),p("span",Rt,"БД"))]),option:O(c=>[h("div",_t,[h("i",{class:j(c.option.icon)},null,2),h("span",null,S(c.option.label),1),c.option.isPrimary?(o(),P(i.Tag,{key:0,severity:"success",value:"Primary",size:"small"})):c.option.isOwned?(o(),P(i.Tag,{key:1,severity:"info",value:"Owned",size:"small"})):w("",!0)])]),_:1},8,["modelValue","options"]),W(k(f,{icon:"pi pi-question-circle",text:"",rounded:"",onClick:i.openHelp,severity:"secondary","aria-label":"Помощь"},null,512),[[I,i.t("help"),void 0,{bottom:!0}]]),W(k(f,{icon:"pi pi-user",text:"",rounded:"",onClick:i.toggleUserMenu,severity:"secondary"},null,512),[[I,i.userName,void 0,{bottom:!0}]]),k(i.Menu,{ref:"userMenu",model:i.userMenuItems,popup:""},null,8,["model"])])]),_:1},8,["model"]),h("div",{class:j(["content",{"content-loading":i.shouldShowSwitchingOverlay}])},[i.shouldShowSwitchingOverlay?(o(),p("div",Bt,[h("div",Ut,[k(i.ProgressSpinner,{style:{width:"50px",height:"50px"},strokeWidth:"4"}),e[8]||(e[8]=h("p",{class:"mt-3 text-lg font-semibold"},"Переключение БД...",-1))])])):w("",!0),(o(),P(i.SafeRouterView,{key:i.database}))],2),k(m,{visible:i.passwordChangeVisible,"onUpdate:visible":e[5]||(e[5]=c=>i.passwordChangeVisible=c),header:i.t("passwordChange"),modal:!0,style:{width:"400px"}},{footer:O(()=>[k(f,{label:i.t("cancel"),icon:"pi pi-times",onClick:e[4]||(e[4]=c=>i.passwordChangeVisible=!1),text:""},null,8,["label"]),k(f,{label:i.t("change"),icon:"pi pi-check",onClick:i.changePassword,loading:i.passwordChanging},null,8,["label","loading"])]),default:O(()=>[h("div",jt,[i.passwordMessage?(o(),P(r,{key:0,severity:i.passwordMessageSeverity},{default:O(()=>[ke(S(i.passwordMessage),1)]),_:1},8,["severity"])):w("",!0),h("div",Ht,[h("label",Gt,S(i.t("currentPassword")),1),k(u,{id:"old-pwd",modelValue:i.oldPassword,"onUpdate:modelValue":e[1]||(e[1]=c=>i.oldPassword=c),feedback:!1,toggleMask:"",onKeyup:X(i.changePassword,["enter"])},null,8,["modelValue"])]),h("div",qt,[h("label",Zt,S(i.t("newPassword")),1),k(u,{id:"new-pwd",modelValue:i.newPassword,"onUpdate:modelValue":e[2]||(e[2]=c=>i.newPassword=c),toggleMask:"",onKeyup:X(i.changePassword,["enter"])},null,8,["modelValue"])]),h("div",Wt,[h("label",Jt,S(i.t("repeatPassword")),1),k(u,{id:"new-again",modelValue:i.newPasswordRepeat,"onUpdate:modelValue":e[3]||(e[3]=c=>i.newPasswordRepeat=c),feedback:!1,toggleMask:"",onKeyup:X(i.changePassword,["enter"])},null,8,["modelValue"])])])]),_:1},8,["visible","header"]),h("div",Qt,[h("small",Yt,"Integram v"+S(i.version),1)])])}const un=Qe(Vt,[["render",Xt],["__scopeId","data-v-c3c19317"],["__file","/home/hive/integram-standalone/src/views/pages/Integram/IntegramMain.vue"]]);export{un as default};
