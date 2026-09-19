import assert from 'node:assert/strict';
import test from 'node:test';
import {imageAutofill, isImageValue} from '../public/assets/native-images-20260915.mjs';
const image='data:image/png;base64,aW1hZ2U=';
test('gambar profil terisi otomatis, tanpa memakai foto profil sebagai logo',()=>{
 const result=imageAutofill({id:'a',logoDataUrl:image,stempelDataUrl:image,kopSuratDataUrl:image}, {}, 'a:native-fix-one');
 assert.deepEqual(result.images,{logo:image,stamp:image,letterhead:image});
 assert.deepEqual(imageAutofill({id:'a',fotoProfileDataUrl:image},{},'a:native-fix-one').images,{});
});
test('gambar formulir lain hanya berasal dari akun yang sama dan nilai kosong tetap kosong',()=>{
 const saved={'a:native-fix-two':{__image_logo:image},'ab:native-fix-two':{__image_stamp:image},'b:native-fix-one':{__image_letterhead:image}};
 assert.deepEqual(imageAutofill({id:'a'},saved,'a:native-fix-one').images,{logo:image});
 saved['a:native-fix-one']={__image_logo:''};
 assert.equal(imageAutofill({id:'a',logoDataUrl:image},saved,'a:native-fix-one').images.logo,'');
 assert.deepEqual(imageAutofill({id:'a',role:'kurator'},saved,'a:native-fix-one').images,{});
});
test('gambar yang bertentangan dan URL luar tidak dipilih otomatis',()=>{
 assert.equal(isImageValue('https://example.test/logo.png'),false);
 assert.equal(isImageValue('data:image/svg+xml;base64,aW1hZ2U='),false);
 const result=imageAutofill({id:'a'},{'a:one':{__image_logo:image},'a:two':{__image_logo:'data:image/png;base64,YWJj'}},'a:native-fix-one');
 assert.deepEqual(result.images,{});
});
