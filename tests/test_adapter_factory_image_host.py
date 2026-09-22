import pytest

from app import adapter_factory
from app.adapters.image_host.imgbb import ImgbbAdapter
from app.adapters.image_host.imgbox import ImgboxAdapter
from app.adapters.image_host.pixhost import PixhostAdapter
from app.adapters.image_host.ptpimg import PtpimgAdapter
from app.models import AppSetting


def test_default_priority_includes_anonymous_hosts_even_without_keys(db_session):
    chain = adapter_factory.build_image_host_chain(db_session)

    assert any(isinstance(a, ImgboxAdapter) for a in chain._adapters)
    assert any(isinstance(a, PixhostAdapter) for a in chain._adapters)
    assert not any(isinstance(a, PtpimgAdapter) for a in chain._adapters)
    assert not any(isinstance(a, ImgbbAdapter) for a in chain._adapters)


def test_configured_keys_are_included_in_priority_order(db_session):
    db_session.add_all([
        AppSetting(key="image_host_priority", value="ptpimg,imgbb,imgbox"),
        AppSetting(key="image_host_ptpimg_api_key", value="ptp-key"),
        AppSetting(key="image_host_imgbb_api_key", value="imgbb-key"),
    ])
    db_session.commit()

    chain = adapter_factory.build_image_host_chain(db_session)

    assert [type(a) for a in chain._adapters] == [PtpimgAdapter, ImgbbAdapter, ImgboxAdapter]


def test_unknown_host_in_priority_raises_config_error(db_session):
    db_session.add(AppSetting(key="image_host_priority", value="notahost"))
    db_session.commit()

    with pytest.raises(adapter_factory.ImageHostConfigError):
        adapter_factory.build_image_host_chain(db_session)


def test_priority_without_imgbox_and_no_keys_raises_config_error(db_session):
    db_session.add(AppSetting(key="image_host_priority", value="ptpimg,imgbb"))
    db_session.commit()

    with pytest.raises(adapter_factory.ImageHostConfigError):
        adapter_factory.build_image_host_chain(db_session)
