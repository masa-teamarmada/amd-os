import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import ts from 'typescript';
registerHooks({
  resolve(specifier,context,next){
    let target;
    if(specifier.startsWith('@/'))target=pathToFileURL(resolve(process.cwd(),'src',specifier.slice(2)));
    else if(specifier.startsWith('./')||specifier.startsWith('../'))target=new URL(specifier,context.parentURL);
    if(target&&target.protocol==='file:'&&!existsSync(target)&&existsSync(fileURLToPath(target)+'.tsx'))return {url:target.href+'.tsx',shortCircuit:true};
    return next(specifier,context);
  },
  load(url,context,next){if(url.endsWith('.tsx'))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};return next(url,context);}
});
