import copy
import unittest
from export_heat_results import build_payload

class ExportContract(unittest.TestCase):
    def setUp(self):
        self.metadata={'regionKind':'area','asOfDate':'2026-10-27','analysisVersion':'test-only','source':'unit-test fixture','definition':'test contract only','referencePeriods':[{'indicator':'fixture','period':'2025'}],'scope':'observed-classification','review':{'approved':True,'reviewedAt':'2026-10-27','reviewedBy':'test fixture','method':'unit test'}}
        self.row={'regionCode':'1000000','classification':'overheated','reason':'unit test only','evidence':[{'label':'fixture','value':1,'unit':'test','period':'2025'}]}
    def test_payload_preserves_null_and_does_not_mutate_input(self):
        row=copy.deepcopy(self.row);row['evidence'].append({'label':'missing','value':None,'unit':'test','period':'2025'})
        before=copy.deepcopy(row)
        data=build_payload(self.metadata,[row],{'1000000'})
        self.assertIsNone(data['results'][0]['evidence'][1]['value']);self.assertEqual(row,before)
    def test_unapproved_or_wrong_geography_is_rejected(self):
        metadata=copy.deepcopy(self.metadata);metadata['review']['approved']=False
        with self.assertRaises(ValueError):build_payload(metadata,[self.row],{'1000000'})
        with self.assertRaises(ValueError):build_payload(self.metadata,[self.row],{'2000000'})
    def test_duplicate_or_blank_numeric_evidence_is_rejected(self):
        with self.assertRaises(ValueError):build_payload(self.metadata,[self.row,self.row],{'1000000'})
        row=copy.deepcopy(self.row);row['evidence'][0]['value']=None
        with self.assertRaises(ValueError):build_payload(self.metadata,[row],{'1000000'})
    def test_missing_evidence_key_and_invalid_date_are_rejected(self):
        row=copy.deepcopy(self.row);del row['evidence'][0]['value']
        with self.assertRaises(ValueError):build_payload(self.metadata,[row],{'1000000'})
        metadata=copy.deepcopy(self.metadata);metadata['asOfDate']='2026-02-30'
        with self.assertRaises(ValueError):build_payload(metadata,[self.row],{'1000000'})

if __name__=='__main__':unittest.main()
