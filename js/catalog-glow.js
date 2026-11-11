(function(){
  'use strict';
  function colorFromImage(url,host,token){
    var img=new Image();
    img.crossOrigin='anonymous';
    img.onload=function(){
      if(host.dataset.paletteToken!==token)return;
      try{
        var canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
        canvas.width=32;canvas.height=18;ctx.drawImage(img,0,0,32,18);
        var data=ctx.getImageData(0,0,32,18).data,bins=new Array(18);
        for(var i=0;i<bins.length;i++)bins[i]={score:0,r:0,g:0,b:0,n:0};
        for(var p=0;p<data.length;p+=4){
          var r=data[p],g=data[p+1],b=data[p+2],max=Math.max(r,g,b),min=Math.min(r,g,b);
          var sat=max?((max-min)/max):0,lum=(.2126*r+.7152*g+.0722*b)/255;
          if(sat<.2||lum<.09||lum>.9)continue;
          var hue=0,d=max-min;
          if(d){if(max===r)hue=((g-b)/d)%6;else if(max===g)hue=(b-r)/d+2;else hue=(r-g)/d+4;hue=(hue*60+360)%360;}
          var bin=Math.min(17,Math.floor(hue/20)),weight=sat*(.55+lum*.45);
          bins[bin].score+=weight;bins[bin].r+=r*weight;bins[bin].g+=g*weight;bins[bin].b+=b*weight;bins[bin].n+=weight;
        }
        var best=bins.reduce(function(a,b){return b.score>a.score?b:a;},bins[0]);
        if(!best.n)return;
        host.style.setProperty('--spot-rgb',[best.r,best.g,best.b].map(function(v){return Math.round(v/best.n);}).join(','));
      }catch(_){}
    };
    img.onerror=function(){};
    img.src=url;
  }
  function watch(host){
    if(host.dataset.paletteObserver)return;
    host.dataset.paletteObserver='1';
    var observer=new MutationObserver(function(){
      host.querySelectorAll('.cat-spot-bg').forEach(function(layer){
        var bg=layer.style.backgroundImage||'',match=bg.match(/url\(["']?(.*?)["']?\)/);
        if(!match)return;
        var url=match[1];
        if(layer.dataset.paletteUrl===url)return;
        layer.dataset.paletteUrl=url;
        var token=String(Date.now())+Math.random();
        host.dataset.paletteToken=token;
        colorFromImage(url,host,token);
      });
    });
    observer.observe(host,{subtree:true,attributes:true,attributeFilter:['style','class']});
  }
  function init(){
    document.querySelectorAll('.cat-spot').forEach(watch);
    new MutationObserver(function(records){
      records.forEach(function(record){
        record.addedNodes.forEach(function(node){
          if(node.nodeType!==1)return;
          if(node.matches&&node.matches('.cat-spot'))watch(node);
          if(node.querySelectorAll)node.querySelectorAll('.cat-spot').forEach(watch);
        });
      });
    }).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();