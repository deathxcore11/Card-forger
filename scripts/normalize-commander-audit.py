"""Normalize the supplied captured audit, without fetching or updating prices."""
import csv, hashlib, io, json, pathlib, sys, zipfile
source, destination = map(pathlib.Path, sys.argv[1:3])
with zipfile.ZipFile(source) as archive:
    prefix = 'CardStashy-100-Random-Commander-Audit/'
    raw = json.loads(archive.read(prefix+'data/Card-reference-catalog.json'))
    def normalize(card):
        fields = {'printingId':'id','oracleId':'oracle_id','oracleText':'oracle_text','typeLine':'type_line','manaCost':'mana_cost','manaValue':'cmc','colorIdentity':'color_identity','cardFaces':'card_faces'}
        return {fields.get(k,k): [normalize(f) for f in v] if k in ['cardFaces','card_faces'] else v for k,v in card.items() if k not in ['prices','quote','unitReferenceQuoteUsd']}
    cards = {k:normalize(v) for k,v in raw['cards'].items()}
    decks = {}
    for row in csv.DictReader(io.StringIO(archive.read(prefix+'data/Card-rows.csv').decode('utf-8-sig'))):
        attempt = int(row['attempt'])
        deck = decks.setdefault(attempt, {'attempt':attempt,'commander':row['actual_commander'],'cards':[]})
        deck['cards'].append({'name':row['card_name'],'qty':int(row['quantity']),'zone':'commander' if row['is_actual_commander'].lower()=='true' else 'main','card':cards[row['printing_id']]})
destination.write_text(json.dumps({'inputSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'decks':list(decks.values())}))
