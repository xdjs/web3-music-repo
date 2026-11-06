import{a as j}from"./chunk-SCZDCUWQ.js";import{a as O}from"./chunk-AZKI7CIV.js";import{a as g}from"./chunk-6VTFFJKV.js";import{a as I}from"./chunk-SUZSO3IJ.js";import{a as T}from"./chunk-X32BDSZP.js";import"./chunk-Z62LLTQL.js";import"./chunk-BXAFGIUZ.js";import"./chunk-XE2VNFXM.js";import"./chunk-25IT3T5G.js";import{b as o,f as F}from"./chunk-7HBLSAB2.js";import{a as E}from"./chunk-6BBTINL2.js";import"./chunk-X55RCBEV.js";import"./chunk-AAIZPJ6V.js";import"./chunk-4IZMZKP2.js";import"./chunk-QCZJZLKO.js";import{Ca as S,Ra as w,vb as b,zb as C}from"./chunk-XINCQYYQ.js";import"./chunk-GP2Z5IJL.js";import{a as M,b as D}from"./chunk-L3SRQ247.js";import"./chunk-76WRXHHL.js";import"./chunk-ICZM37XQ.js";import"./chunk-UXR3YP4I.js";import"./chunk-F3U2UFLK.js";import"./chunk-QUX7GYXV.js";import"./chunk-EDOXQSBC.js";import"./chunk-NBXQ4LHY.js";import"./chunk-JPKQ4D5J.js";import"./chunk-RXUH6W7B.js";import"./chunk-4HKFMBDG.js";import"./chunk-EWZIQ6S7.js";import"./chunk-4A5QGTY6.js";import"./chunk-OLSVNNSJ.js";import"./chunk-UDV72RPV.js";import"./chunk-OLVD2QO2.js";import"./chunk-B2MIHH64.js";import"./chunk-QWVHHNLJ.js";import"./chunk-46JSU44N.js";import{f as y}from"./chunk-PLGCP6SF.js";var e=y(D(),1),r=y(M(),1),d=y(E(),1);var q="#8a63d2",N=({appName:m,loading:f,success:u,errorMessage:a,connectUri:t,onBack:s,onClose:n,onOpenFarcaster:i})=>(0,e.jsx)(T,d.isMobile||f?d.isIOS?{title:a?a.message:"Add a signer to Farcaster",subtitle:a?a.detail:`This will allow ${m} to add casts, likes, follows, and more on your behalf.`,icon:g,iconVariant:"loading",iconLoadingStatus:{success:u,fail:!!a},primaryCta:t&&i?{label:"Open Farcaster app",onClick:i}:void 0,onBack:s,onClose:n,watermark:!0}:{title:a?a.message:"Requesting signer from Farcaster",subtitle:a?a.detail:"This should only take a moment",icon:g,iconVariant:"loading",iconLoadingStatus:{success:u,fail:!!a},onBack:s,onClose:n,watermark:!0,children:t&&d.isMobile&&(0,e.jsx)(P,{children:(0,e.jsx)(O,{text:"Take me to Farcaster",url:t,color:q})})}:{title:"Add a signer to Farcaster",subtitle:`This will allow ${m} to add casts, likes, follows, and more on your behalf.`,onBack:s,onClose:n,watermark:!0,children:(0,e.jsxs)(R,{children:[(0,e.jsx)(V,{children:t?(0,e.jsx)(I,{url:t,size:275,squareLogoElement:g}):(0,e.jsx)($,{children:(0,e.jsx)(F,{})})}),(0,e.jsxs)(z,{children:[(0,e.jsx)(U,{children:"Or copy this link and paste it into a phone browser to open the Farcaster app."}),t&&(0,e.jsx)(j,{text:t,itemName:"link",color:q})]})]})}),P=o.div`
  margin-top: 24px;
`,R=o.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
`,V=o.div`
  padding: 24px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 275px;
`,z=o.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`,U=o.div`
  font-size: 0.875rem;
  text-align: center;
  color: var(--privy-color-foreground-2);
`,$=o.div`
  position: relative;
  width: 82px;
  height: 82px;
`,ee={component:()=>{let{lastScreen:m,navigateBack:f,data:u}=C(),a=b(),{requestFarcasterSignerStatus:t,closePrivyModal:s}=S(),[n,i]=(0,r.useState)(void 0),[B,k]=(0,r.useState)(!1),[_,x]=(0,r.useState)(!1),h=(0,r.useRef)([]),c=u?.farcasterSigner;(0,r.useEffect)((()=>{let A=Date.now(),l=setInterval((async()=>{if(!c?.public_key)return clearInterval(l),void i({retryable:!0,message:"Connect failed",detail:"Something went wrong. Please try again."});c.status==="approved"&&(clearInterval(l),k(!1),x(!0),h.current.push(setTimeout((()=>s({shouldCallAuthOnSuccess:!1,isSuccess:!0})),w)));let p=await t(c?.public_key),L=Date.now()-A;p.status==="approved"?(clearInterval(l),k(!1),x(!0),h.current.push(setTimeout((()=>s({shouldCallAuthOnSuccess:!1,isSuccess:!0})),w))):L>3e5?(clearInterval(l),i({retryable:!0,message:"Connect failed",detail:"The request timed out. Try again."})):p.status==="revoked"&&(clearInterval(l),i({retryable:!0,message:"Request rejected",detail:"The request was rejected. Please try again."}))}),2e3);return()=>{clearInterval(l),h.current.forEach((p=>clearTimeout(p)))}}),[]);let v=c?.status==="pending_approval"?c.signer_approval_url:void 0;return(0,e.jsx)(N,{appName:a.name,loading:B,success:_,errorMessage:n,connectUri:v,onBack:m?f:void 0,onClose:s,onOpenFarcaster:()=>{v&&(window.location.href=v)}})}};export{ee as FarcasterSignerStatusScreen,N as FarcasterSignerStatusView,ee as default};
