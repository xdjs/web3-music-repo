import{a as z,b as q}from"./chunk-KTNNB3DM.js";import{a as k}from"./chunk-SCZDCUWQ.js";import{g as j}from"./chunk-2DOS22KC.js";import{F as P}from"./chunk-RXZTY6KY.js";import{a as F}from"./chunk-X32BDSZP.js";import"./chunk-Z62LLTQL.js";import"./chunk-BXAFGIUZ.js";import"./chunk-XE2VNFXM.js";import{b as d}from"./chunk-7HBLSAB2.js";import{A as E,z as x}from"./chunk-GDU2R5PA.js";import"./chunk-6BBTINL2.js";import"./chunk-X55RCBEV.js";import"./chunk-AAIZPJ6V.js";import"./chunk-4IZMZKP2.js";import"./chunk-QCZJZLKO.js";import{Bb as I,Ca as N,N as R,Q as D,Ra as U,S as f,nb as M,zb as O}from"./chunk-XINCQYYQ.js";import{b as v}from"./chunk-GP2Z5IJL.js";import{a as B,b as X}from"./chunk-L3SRQ247.js";import"./chunk-76WRXHHL.js";import"./chunk-ICZM37XQ.js";import"./chunk-UXR3YP4I.js";import{d as L,p as A}from"./chunk-F3U2UFLK.js";import"./chunk-QUX7GYXV.js";import"./chunk-EDOXQSBC.js";import"./chunk-NBXQ4LHY.js";import"./chunk-JPKQ4D5J.js";import"./chunk-RXUH6W7B.js";import"./chunk-4HKFMBDG.js";import"./chunk-EWZIQ6S7.js";import"./chunk-4A5QGTY6.js";import"./chunk-OLSVNNSJ.js";import"./chunk-UDV72RPV.js";import"./chunk-OLVD2QO2.js";import"./chunk-B2MIHH64.js";import"./chunk-QWVHHNLJ.js";import"./chunk-46JSU44N.js";import{f as _}from"./chunk-PLGCP6SF.js";var t=_(X(),1);var a=_(B(),1);var Y=d.img`
  && {
    height: ${e=>e.size==="sm"?"65px":"140px"};
    width: ${e=>e.size==="sm"?"65px":"140px"};
    border-radius: 16px;
    margin-bottom: 12px;
  }
`,Z=e=>{if(!L(e))return e;try{let i=A(e);return i.includes("\uFFFD")?e:i}catch{return e}},ee=e=>{try{let i=v.decode(e),o=new TextDecoder().decode(i);return o.includes("\uFFFD")?e:o}catch{return e}},te=e=>{let{types:i,primaryType:o,...l}=e.typedData;return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(ae,{data:l}),(0,t.jsx)(k,{text:(s=e.typedData,JSON.stringify(s,null,2)),itemName:"full payload to clipboard"})," "]});var s},re=({method:e,messageData:i,copy:o,iconUrl:l,isLoading:s,success:p,walletProxyIsLoading:g,errorMessage:u,isCancellable:h,onSign:c,onCancel:C,onClose:m})=>(0,t.jsx)(F,{title:o.title,subtitle:o.description,showClose:!0,onClose:m,icon:P,iconVariant:"subtle",helpText:u?(0,t.jsx)(oe,{children:u}):void 0,primaryCta:{label:o.buttonText,onClick:c,disabled:s||p||g,loading:s},secondaryCta:h?{label:"Not now",onClick:C,disabled:s||p||g}:void 0,watermark:!0,children:(0,t.jsxs)(j,{children:[l?(0,t.jsx)(Y,{style:{alignSelf:"center"},size:"sm",src:l,alt:"app image"}):null,(0,t.jsxs)(ie,{children:[e==="personal_sign"&&(0,t.jsx)(V,{children:Z(i)}),e==="eth_signTypedData_v4"&&(0,t.jsx)(te,{typedData:i}),e==="solana_signMessage"&&(0,t.jsx)(V,{children:ee(i)})]})]})}),Ee={component:()=>{let{authenticated:e}=I(),{initializeWalletProxy:i,closePrivyModal:o}=N(),{navigate:l,data:s,onUserCloseViaDialogOrKeybindRef:p}=O(),[g,u]=(0,a.useState)(!0),[h,c]=(0,a.useState)(""),[C,m]=(0,a.useState)(),[S,T]=(0,a.useState)(null),[J,w]=(0,a.useState)(!1);(0,a.useEffect)((()=>{e||l("LandingScreen")}),[e]),(0,a.useEffect)((()=>{i(M).then((r=>{u(!1),r||(c("An error has occurred, please try again."),m(new E(new x(h,f.E32603_DEFAULT_INTERNAL_ERROR.eipCode))))}))}),[]);let{method:W,data:$,confirmAndSign:G,onSuccess:H,onFailure:K,uiOptions:n}=s.signMessage,Q={title:n?.title||"Sign message",description:n?.description||"Signing this message will not cost you any fees.",buttonText:n?.buttonText||"Sign and continue"},y=r=>{r?H(r):K(C||new E(new x("The user rejected the request.",f.E4001_USER_REJECTED_REQUEST.eipCode))),o({shouldCallAuthOnSuccess:!1}),setTimeout((()=>{T(null),c(""),m(void 0)}),200)};return p.current=()=>{y(S)},(0,t.jsx)(re,{method:W,messageData:$,copy:Q,iconUrl:n?.iconUrl&&typeof n.iconUrl=="string"?n.iconUrl:void 0,isLoading:J,success:S!==null,walletProxyIsLoading:g,errorMessage:h,isCancellable:n?.isCancellable,onSign:async()=>{w(!0),c("");try{let r=await G();T(r),w(!1),setTimeout((()=>{y(r)}),U)}catch(r){console.error(r);let b=r instanceof D&&r.code===R.MISSING_MFA_ENROLLMENT?r.message:"An error has occurred, please try again.";c(b),m(new E(new x(b,f.E32603_DEFAULT_INTERNAL_ERROR.eipCode))),w(!1)}},onCancel:()=>y(null),onClose:()=>y(S)})}},ie=d.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
`,oe=d.p`
  && {
    margin: 0;
    width: 100%;
    text-align: center;
    color: var(--privy-color-error-dark);
    font-size: 14px;
    line-height: 22px;
  }
`,ae=d(q)`
  margin-top: 0;
`,V=d(z)`
  margin-top: 0;
`;export{Ee as SignRequestScreen,re as SignRequestView,Ee as default};
