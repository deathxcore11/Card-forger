import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from source_literals import parse,card_signals
class SourceLiteralContract(unittest.TestCase):
 def test_attacks_do_not_consume_abilities_and_locale_order(self):
  c=parse('''const card: Card = {name:{de:'Test',en:'Card'},attacks:[{name:{fr:'Un',en:'First'},damage:0,cost:[]},{name:{de:'Zwei'}}],abilities:[{name:{en:'Must not become an attack'}}],stage:'LEVEL-UP',hp:0,set:Set};export default card''')
  self.assertEqual(card_signals(c),{'hp':0,'stage':'LEVEL-UP','attackNames':['First']})
 def test_rejects_executable_source(self):
  for value in ['dangerous()', 'new Object()', '`template`', '...other']:
   with self.assertRaises((ValueError,AssertionError,IndexError)):parse('const card: Card = {attacks:'+value+'};export default card')
 def test_missing_fields_and_keyed_strings(self):
  self.assertEqual(card_signals({'attacks':[{'name':{'de':'Deutsch'}},{'name':'Literal'},{}],'hp':None}),{'attackNames':['Literal']})
if __name__=='__main__':unittest.main()
