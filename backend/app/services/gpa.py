from bisect import bisect_right

PERCENTAGE_GPA_POINTS = [
    (0.0, 1.0),
    (50.0, 1.7),
    (55.0, 2.0),
    (60.0, 2.3),
    (65.0, 2.7),
    (70.0, 3.0),
    (75.0, 3.3),
    (80.0, 3.7),
    (85.0, 4.0),
    (100.0, 4.0),
]


def to_percentage(scale: str, value: float) -> float:
    if scale == "percentage":
        return max(0.0, min(value, 100.0))
    if scale == "10":
        return max(0.0, min(value * 9.5, 100.0))
    if scale == "5.0":
        return max(0.0, min(value / 5.0 * 100.0, 100.0))
    if scale == "4.0":
        return max(0.0, min(value / 4.0 * 100.0, 100.0))
    raise ValueError("scale must be one of: 4.0, 5.0, 10, percentage")


def percentage_to_g4(percentage: float) -> float:
    value = max(0.0, min(percentage, 100.0))
    points = PERCENTAGE_GPA_POINTS
    index = bisect_right([point[0] for point in points], value) - 1
    if index >= len(points) - 1:
        return 4.0
    lower_percentage, lower_gpa = points[index]
    upper_percentage, upper_gpa = points[index + 1]
    if upper_percentage == lower_percentage:
        return upper_gpa
    ratio = (value - lower_percentage) / (upper_percentage - lower_percentage)
    return round(lower_gpa + ratio * (upper_gpa - lower_gpa), 2)


def to_g4(scale: str, value: float) -> float:
    if scale == "4.0":
        return round(max(0.0, min(value, 4.0)), 2)
    if scale == "5.0":
        return round(max(0.0, min(value / 5.0 * 4.0, 4.0)), 2)
    return percentage_to_g4(to_percentage(scale, value))


def bs_marks_to_g4(obtained: float, total: float) -> float:
    if obtained < 0 or total <= 0 or obtained > total:
        raise ValueError("marks must be non-negative and obtained marks cannot exceed total marks")
    return percentage_to_g4(obtained / total * 100.0)
