import pytest

from app.services.gpa import bs_marks_to_g4, percentage_to_g4, to_g4, to_percentage


@pytest.mark.parametrize(
    ("scale", "value", "expected"),
    [("4.0", 3.4, 3.4), ("5.0", 4.0, 3.2), ("10", 8.0, 3.38), ("percentage", 80, 3.7)],
)
def test_gpa_scale_conversion(scale, value, expected):
    assert to_g4(scale, value) == expected


def test_percentage_conversion_interpolates_and_clamps():
    assert percentage_to_g4(82) == 3.82
    assert percentage_to_g4(-5) == 1.0
    assert percentage_to_g4(105) == 4.0
    assert to_percentage("10", 8) == 76.0


def test_marks_conversion_validation():
    assert bs_marks_to_g4(880, 1100) == 3.7
    with pytest.raises(ValueError):
        bs_marks_to_g4(1101, 1100)
