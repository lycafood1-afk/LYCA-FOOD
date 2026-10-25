import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesSearch,filterCustomerCatalogue} from './catalogue-search.mjs';

const category={id:'fruit',title:'Fruit & Juice Ingredients',shortTitle:'Fruit',description:'For beverage manufacturing',groups:[{name:'Citrus Range',items:['Blood Orange Concentrate','Lemon Puree']}]};
const ingredients=[{category:'fruit',group:'Citrus Range',name:'Blood Orange Concentrate',description:'A café beverage base',specifications:'Frozen, 65 Brix',partner:'ECOM'},{category:'fruit',group:'Citrus Range',name:'Lemon Puree',description:'Tart citrus',specifications:'Aseptic',partner:'Medibel'}];
test('case, accents, punctuation and word order match across fields',()=>{
  assert(matchesSearch('  ECOM   orange fruit  ',['Blood Orange Concentrate','Fruit & Juice','ECOM']));
  assert(matchesSearch('CAFE 65-brix',['café beverage base','Frozen, 65 Brix']));
  assert(matchesSearch('juice & fruit',['Fruit and Juice']));
  assert(matchesSearch('தமிழ்',['பொருள் தமிழ்']));
  assert(!matchesSearch('orange medibel',['Blood Orange','ECOM']));
});
test('customer results match details, partner, category and specifications',()=>{
  for(const query of ['ecom orange','fruit concentrate','65 BRIX café','beverage orange']){
    assert.deepEqual(filterCustomerCatalogue([category],ingredients,query)[0].groups[0].items,['Blood Orange Concentrate']);
  }
  assert.deepEqual(filterCustomerCatalogue([category],ingredients,'medibel')[0].groups[0].items,['Lemon Puree']);
  assert.equal(filterCustomerCatalogue([category],ingredients,'missing ingredient').length,0);
});
test('clearing search restores all items without changing source data',()=>{
  const before=JSON.stringify(category);
  filterCustomerCatalogue([category],ingredients,'orange');
  assert.deepEqual(filterCustomerCatalogue([category],ingredients,'   ')[0].groups[0].items,category.groups[0].items);
  assert.equal(JSON.stringify(category),before);
});
test('new empty categories can be found by their own name',()=>{
  const empty={id:'spices',title:'Spices & Herbs',shortTitle:'Spices',description:'',groups:[]};
  assert.deepEqual(filterCustomerCatalogue([category,empty],ingredients,'herbs').map(c=>c.id),['spices']);
  assert.equal(filterCustomerCatalogue([category,empty],ingredients,'').length,2);
});
