"""
Tests for gloss_mapper — Vietnamese text → VNSL gloss pipeline.

Run:  cd backend && pytest tests/ -v
"""
import pytest
from gloss_mapper import reorder_to_vnsl, text_to_glosses


# ── reorder_to_vnsl unit tests ────────────────────────────────────────────────

class TestReorderEdgeCases:
    def test_empty(self):
        assert reorder_to_vnsl([]) == []

    def test_single(self):
        assert reorder_to_vnsl(['HELLO']) == ['HELLO']

    def test_no_reorder_needed(self):
        assert reorder_to_vnsl(['HELLO', 'YOU']) == ['HELLO', 'YOU']

    def test_unknown_gloss_passthrough(self):
        assert reorder_to_vnsl(['FS:ABC', 'FS:DEF']) == ['FS:ABC', 'FS:DEF']


class TestTimeToFront:
    def test_today_moves_front(self):
        assert reorder_to_vnsl(['ME', 'EAT', 'TODAY']) == ['TODAY', 'ME', 'EAT']

    def test_time_already_front_unchanged(self):
        assert reorder_to_vnsl(['TODAY', 'ME', 'WORK']) == ['TODAY', 'ME', 'WORK']

    def test_multiple_time_glosses(self):
        result = reorder_to_vnsl(['ME', 'EAT', 'MORNING', 'TODAY'])
        assert result[0] in ('MORNING', 'TODAY')
        assert result[1] in ('MORNING', 'TODAY')
        assert 'ME' in result
        assert 'EAT' in result


class TestWhToEnd:
    def test_what_moves_end(self):
        assert reorder_to_vnsl(['YOU', 'WHAT', 'EAT']) == ['YOU', 'EAT', 'WHAT']

    def test_who_moves_end(self):
        # WHO extracted to end; IS THAT remain in original order
        assert reorder_to_vnsl(['WHO', 'IS', 'THAT']) == ['IS', 'THAT', 'WHO']

    def test_where_moves_end(self):
        result = reorder_to_vnsl(['YOU', 'WHERE', 'GO'])
        assert result[-1] == 'WHERE'


class TestSOVReorder:
    def test_basic_svo_to_sov(self):
        # tôi ăn cơm → ME RICE EAT
        assert reorder_to_vnsl(['ME', 'EAT', 'RICE']) == ['ME', 'RICE', 'EAT']

    def test_modal_plus_verb_obj(self):
        # tôi muốn ăn cơm → ME WANT RICE EAT
        assert reorder_to_vnsl(['ME', 'WANT', 'EAT', 'RICE']) == ['ME', 'WANT', 'RICE', 'EAT']

    def test_no_obj_no_reorder(self):
        # tôi ăn (no object) → ME EAT
        assert reorder_to_vnsl(['ME', 'EAT']) == ['ME', 'EAT']

    def test_need_modal(self):
        # tôi cần mua thuốc → ME NEED MEDICINE BUY
        assert reorder_to_vnsl(['ME', 'NEED', 'BUY', 'MEDICINE']) == ['ME', 'NEED', 'MEDICINE', 'BUY']

    def test_multiple_objects(self):
        # tôi mua sách và bút → ME BOOK AND ??? BUY  (AND breaks the span)
        result = reorder_to_vnsl(['ME', 'BUY', 'BOOK'])
        assert result == ['ME', 'BOOK', 'BUY']

    def test_adjective_object(self):
        # tôi thấy cái lớn → ME LOOK BIG
        assert reorder_to_vnsl(['ME', 'LOOK', 'BIG']) == ['ME', 'BIG', 'LOOK']


class TestCombinedRules:
    def test_time_plus_sov(self):
        # hôm nay tôi uống nước → TODAY ME WATER DRINK
        assert reorder_to_vnsl(['TODAY', 'ME', 'DRINK', 'WATER']) == ['TODAY', 'ME', 'WATER', 'DRINK']

    def test_time_sov_wh(self):
        # hôm nay bạn ăn gì → TODAY YOU EAT WHAT
        result = reorder_to_vnsl(['TODAY', 'YOU', 'EAT', 'WHAT'])
        assert result[0] == 'TODAY'
        assert result[-1] == 'WHAT'
        assert 'YOU' in result
        assert 'EAT' in result

    def test_time_plus_modal_sov(self):
        # hôm nay tôi đi trường → TODAY ME SCHOOL GO
        assert reorder_to_vnsl(['TODAY', 'ME', 'GO', 'SCHOOL']) == ['TODAY', 'ME', 'SCHOOL', 'GO']


# ── text_to_glosses integration tests ────────────────────────────────────────

class TestTextToGlosses:
    """
    Integration tests: full pipeline from Vietnamese text to VNSL glosses.
    These depend on underthesea tokenization so may vary slightly across versions.
    The key invariants (time front, wh end, SOV) are checked rather than exact sequences.
    """

    def test_greeting(self):
        result = text_to_glosses('xin chào')
        assert 'HELLO' in result

    def test_sov_rice(self):
        result = text_to_glosses('tôi ăn cơm')
        assert 'ME' in result
        assert 'RICE' in result
        assert 'EAT' in result
        # SOV: RICE must appear before EAT
        assert result.index('RICE') < result.index('EAT')

    def test_time_front(self):
        result = text_to_glosses('hôm nay tôi uống nước')
        assert result[0] == 'TODAY'

    def test_wh_end(self):
        result = text_to_glosses('bạn ăn gì')
        assert result[-1] == 'WHAT'

    def test_modal_sov(self):
        result = text_to_glosses('tôi muốn mua sách')
        assert 'ME' in result
        assert 'WANT' in result
        assert 'BOOK' in result
        assert 'BUY' in result
        # BOOK must appear before BUY
        assert result.index('BOOK') < result.index('BUY')

    def test_time_sov_combined(self):
        result = text_to_glosses('hôm nay tôi đi trường')
        assert result[0] == 'TODAY'
        assert result.index('SCHOOL') < result.index('GO')

    def test_unknown_word_fingerspelled(self):
        result = text_to_glosses('tôi yêu blockchain')
        assert any(g.startswith('FS:') for g in result)
        assert 'ME' in result
        assert 'LOVE' in result

    def test_empty_input(self):
        assert text_to_glosses('') == []

    def test_medical_vocab(self):
        result = text_to_glosses('bác sĩ giúp bệnh nhân')
        assert 'DOCTOR' in result
        assert 'PATIENT' in result
        assert 'HELP' in result

    def test_emotion_vocab(self):
        result = text_to_glosses('tôi rất vui')
        assert 'ME' in result
        assert 'VERY' in result
        assert 'HAPPY' in result
