import{a as E}from"./chunk-NCOVM3YF.js";import{a as F}from"./chunk-TDXIDR4P.js";import"./chunk-QWEKXT6T.js";import{a as z}from"./chunk-6647YNSB.js";import"./chunk-UASWKFJS.js";import"./chunk-EQI32CQS.js";import"./chunk-ZQYUWCFI.js";import"./chunk-YTD5GNCZ.js";import"./chunk-YXOKYCGA.js";import"./chunk-MJXSXDPB.js";import"./chunk-7CD4GOZP.js";import"./chunk-JWZISZ7T.js";import"./chunk-CMHF6IUL.js";import"./chunk-3IUNZXVO.js";import"./chunk-S4GZCSQQ.js";import"./chunk-VOCEAE6S.js";import"./chunk-73O3WJZ3.js";import"./chunk-DVXUKMO6.js";import"./chunk-K3I4H72F.js";import{o as w}from"./chunk-ZF3BSMZU.js";import"./chunk-OYHRWMED.js";import{O as y,T as $,U as B,V as C,W as S,X as D,Y as T,Z as P,k as v,u as x}from"./chunk-ADUT5MX6.js";import{b as u}from"./chunk-NKBC5UUE.js";import{a as h}from"./chunk-EIBFAW37.js";import"./chunk-WJPS5IPJ.js";var L=v.packet,b,A=(b=class{constructor(){this.packet=[],this.setAccTitle=B,this.getAccTitle=C,this.setDiagramTitle=T,this.getDiagramTitle=P,this.getAccDescription=D,this.setAccDescription=S}getConfig(){let t=w({...L,...x().packet});return t.showBits&&(t.paddingY+=10),t}getPacket(){return this.packet}pushWord(t){t.length>0&&this.packet.push(t)}clear(){$(),this.packet=[]}},h(b,"PacketDB"),b),M=1e4,Y=h((e,t)=>{E(e,t);let a=-1,o=[],n=1,{bitsPerRow:l}=t.getConfig();for(let{start:r,end:s,bits:d,label:c}of e.blocks){if(r!==void 0&&s!==void 0&&s<r)throw new Error(`Packet block ${r} - ${s} is invalid. End must be greater than start.`);if(r??(r=a+1),r!==a+1)throw new Error(`Packet block ${r} - ${s??r} is not contiguous. It should start from ${a+1}.`);if(d===0)throw new Error(`Packet block ${r} is invalid. Cannot have a zero bit field.`);for(s??(s=r+(d??1)-1),d??(d=s-r+1),a=s,u.debug(`Packet block ${r} - ${a} with label ${c}`);o.length<=l+1&&t.getPacket().length<M;){let[p,i]=I({start:r,end:s,bits:d,label:c},n,l);if(o.push(p),p.end+1===n*l&&(t.pushWord(o),o=[],n++),!i)break;({start:r,end:s,bits:d,label:c}=i)}}t.pushWord(o)},"populate"),I=h((e,t,a)=>{if(e.start===void 0)throw new Error("start should have been set during first phase");if(e.end===void 0)throw new Error("end should have been set during first phase");if(e.start>e.end)throw new Error(`Block start ${e.start} is greater than block end ${e.end}.`);if(e.end+1<=t*a)return[e,void 0];let o=t*a-1,n=t*a;return[{start:e.start,end:o,label:e.label,bits:o-e.start},{start:n,end:e.end,label:e.label,bits:e.end-n}]},"getNextFittingBlock"),W={parser:{yy:void 0},parse:h(async e=>{let t=await F("packet",e),a=W.parser?.yy;if(!(a instanceof A))throw new Error("parser.parser?.yy was not a PacketDB. This is due to a bug within Mermaid, please report this issue at https://github.com/mermaid-js/mermaid/issues.");u.debug(t),Y(t,a)},"parse")},O=h((e,t,a,o)=>{let n=o.db,l=n.getConfig(),{rowHeight:r,paddingY:s,bitWidth:d,bitsPerRow:c}=l,p=n.getPacket(),i=n.getDiagramTitle(),f=r+s,g=f*(p.length+1)-(i?0:r),k=d*c+2,m=z(t);m.attr("viewBox",`0 0 ${k} ${g}`),y(m,g,k,l.useMaxWidth);for(let[_,N]of p.entries())j(m,N,_,l);m.append("text").text(i).attr("x",k/2).attr("y",g-f/2).attr("dominant-baseline","middle").attr("text-anchor","middle").attr("class","packetTitle")},"draw"),j=h((e,t,a,{rowHeight:o,paddingX:n,paddingY:l,bitWidth:r,bitsPerRow:s,showBits:d})=>{let c=e.append("g"),p=a*(o+l)+l;for(let i of t){let f=i.start%s*r+1,g=(i.end-i.start+1)*r-n;if(c.append("rect").attr("x",f).attr("y",p).attr("width",g).attr("height",o).attr("class","packetBlock"),c.append("text").attr("x",f+g/2).attr("y",p+o/2).attr("class","packetLabel").attr("dominant-baseline","middle").attr("text-anchor","middle").text(i.label),!d)continue;let k=i.end===i.start,m=p-2;c.append("text").attr("x",f+(k?g/2:0)).attr("y",m).attr("class","packetByte start").attr("dominant-baseline","auto").attr("text-anchor",k?"middle":"start").text(i.start),k||c.append("text").attr("x",f+g).attr("y",m).attr("class","packetByte end").attr("dominant-baseline","auto").attr("text-anchor","end").text(i.end)}},"drawWord"),G={draw:O},H={byteFontSize:"10px",startByteColor:"black",endByteColor:"black",labelColor:"black",labelFontSize:"12px",titleColor:"black",titleFontSize:"14px",blockStrokeColor:"black",blockStrokeWidth:"1",blockFillColor:"#efefef"},K=h(({packet:e}={})=>{let t=w(H,e);return`
	.packetByte {
		font-size: ${t.byteFontSize};
	}
	.packetByte.start {
		fill: ${t.startByteColor};
	}
	.packetByte.end {
		fill: ${t.endByteColor};
	}
	.packetLabel {
		fill: ${t.labelColor};
		font-size: ${t.labelFontSize};
	}
	.packetTitle {
		fill: ${t.titleColor};
		font-size: ${t.titleFontSize};
	}
	.packetBlock {
		stroke: ${t.blockStrokeColor};
		stroke-width: ${t.blockStrokeWidth};
		fill: ${t.blockFillColor};
	}
	`},"styles"),Z={parser:W,get db(){return new A},renderer:G,styles:K};export{Z as diagram};
