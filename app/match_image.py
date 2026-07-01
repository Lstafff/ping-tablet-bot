from __future__ import annotations

from io import BytesIO
from pathlib import Path


IMAGE_WIDTH = 1280
IMAGE_HEIGHT = 720
BACKGROUND_COLOR = "#2A62D1"
LEFT_DECOR_COLOR = "#EA4D2E"
RIGHT_DECOR_COLOR = "#303030"
TEXT_COLOR = BACKGROUND_COLOR
WHITE = "#FFFFFF"
FONT_PATH = Path(__file__).resolve().parent.parent / "assets" / "fonts" / "DIN2014-Bold.ttf"


def render_match_score_image(user_score: int, opponent_score: int) -> bytes:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError as error:
        raise RuntimeError("Для генерации картинки счёта нужна зависимость Pillow.") from error

    image = Image.new("RGB", (IMAGE_WIDTH, IMAGE_HEIGHT), BACKGROUND_COLOR)
    draw = ImageDraw.Draw(image)

    draw.ellipse((-288, -139, 291, 440), fill=LEFT_DECOR_COLOR)
    draw.ellipse((866, 250, 1445, 829), fill=RIGHT_DECOR_COLOR)
    draw.rectangle((639, 0, 640, IMAGE_HEIGHT), fill=WHITE)

    draw_score_circle(draw, (320, 360), str(user_score), ImageFont)
    draw_score_circle(draw, (960, 360), str(opponent_score), ImageFont)

    output = BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue()


def draw_score_circle(draw: object, center: tuple[int, int], score: str, image_font: object) -> None:
    circle_size = 220
    radius = circle_size // 2
    center_x, center_y = center
    draw.ellipse(
        (
            center_x - radius,
            center_y - radius,
            center_x + radius,
            center_y + radius,
        ),
        fill=WHITE,
    )

    font_size = score_font_size(score)
    font = image_font.truetype(str(FONT_PATH), font_size)
    text_bbox = draw.textbbox((0, 0), score, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    text_x = center_x - text_width / 2 - text_bbox[0]
    text_y = center_y - text_height / 2 - text_bbox[1] - 4
    draw.text((text_x, text_y), score, fill=TEXT_COLOR, font=font)


def score_font_size(score: str) -> int:
    if len(score) <= 2:
        return 120
    if len(score) == 3:
        return 100
    return 78
