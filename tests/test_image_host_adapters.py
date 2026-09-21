import httpx
import pytest

from app.adapters.image_host.base import ImageHostError
from app.adapters.image_host.chain import ImageHostChain
from app.adapters.image_host.imgbb import ImgbbAdapter
from app.adapters.image_host.ptpimg import PtpimgAdapter


def _client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_ptpimg_upload_returns_public_url(tmp_path):
    image = tmp_path / "shot.png"
    image.write_bytes(b"fake png bytes")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "ptpimg.me"
        return httpx.Response(200, json=[{"code": "abc123", "ext": "png"}])

    adapter = PtpimgAdapter(api_key="key123", client=_client(handler))
    url = adapter.upload(str(image))

    assert url == "https://ptpimg.me/abc123.png"


def test_ptpimg_upload_raises_on_bad_response(tmp_path):
    image = tmp_path / "shot.png"
    image.write_bytes(b"fake png bytes")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[{"unexpected": "shape"}])

    adapter = PtpimgAdapter(api_key="key123", client=_client(handler))

    with pytest.raises(ImageHostError):
        adapter.upload(str(image))


def test_ptpimg_upload_raises_on_http_error(tmp_path):
    image = tmp_path / "shot.png"
    image.write_bytes(b"fake png bytes")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    adapter = PtpimgAdapter(api_key="key123", client=_client(handler))

    with pytest.raises(ImageHostError):
        adapter.upload(str(image))


def test_imgbb_upload_returns_public_url(tmp_path):
    image = tmp_path / "shot.png"
    image.write_bytes(b"fake png bytes")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "api.imgbb.com"
        return httpx.Response(200, json={"success": True, "data": {"image": {"url": "https://imgbb.com/x.png"}}})

    adapter = ImgbbAdapter(api_key="key123", client=_client(handler))
    url = adapter.upload(str(image))

    assert url == "https://imgbb.com/x.png"


def test_imgbb_upload_raises_on_failure_response(tmp_path):
    image = tmp_path / "shot.png"
    image.write_bytes(b"fake png bytes")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"success": False, "error": {"message": "invalid key"}})

    adapter = ImgbbAdapter(api_key="bad", client=_client(handler))

    with pytest.raises(ImageHostError, match="invalid key"):
        adapter.upload(str(image))


class _FakeAdapter:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.called = False

    def upload(self, image_path: str) -> str:
        self.called = True
        if self.error is not None:
            raise self.error
        return self.result


def test_chain_returns_first_successful_upload():
    first = _FakeAdapter(result="https://first.example/x.png")
    second = _FakeAdapter(result="https://second.example/x.png")
    chain = ImageHostChain([first, second])

    url = chain.upload("/tmp/x.png")

    assert url == "https://first.example/x.png"
    assert second.called is False


def test_chain_falls_back_to_next_on_failure():
    first = _FakeAdapter(error=ImageHostError("boom"))
    second = _FakeAdapter(result="https://second.example/x.png")
    chain = ImageHostChain([first, second])

    url = chain.upload("/tmp/x.png")

    assert url == "https://second.example/x.png"


def test_chain_raises_last_error_if_all_fail():
    first = _FakeAdapter(error=ImageHostError("first failed"))
    second = _FakeAdapter(error=ImageHostError("second failed"))
    chain = ImageHostChain([first, second])

    with pytest.raises(ImageHostError, match="second failed"):
        chain.upload("/tmp/x.png")


def test_chain_requires_at_least_one_adapter():
    with pytest.raises(ValueError):
        ImageHostChain([])
