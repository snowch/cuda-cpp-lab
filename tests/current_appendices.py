# Copyright © 2026 Christopher Snow.
"""Shared setup/profiling pages belong to the current course after V1 retirement."""
from playwright.sync_api import expect
from html.parser import HTMLParser
from urllib.parse import urljoin,urlsplit,unquote

class Links(HTMLParser):
    def __init__(self,source):
        super().__init__();self.links=[];self.ids=set();self.feed(source)
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if "id" in attrs:self.ids.add(attrs["id"])
        if tag=="a" and attrs.get("href"):self.links.append(attrs["href"])

def check_local_links(root):
    dist=root/"dist";count=0
    for file in dist.rglob("*.html"):
        if "releases" in file.relative_to(dist).parts:continue
        for href in Links(file.read_text()).links:
            target=urlsplit(urljoin("http://course/"+str(file.relative_to(dist)),href))
            if target.netloc!="course":continue
            path=dist/unquote(target.path.lstrip("/"))
            if path.is_dir():path=path/"index.html"
            assert path.is_file(),(file,href)
            if target.fragment and path.suffix==".html":
                assert unquote(target.fragment) in Links(path.read_text()).ids,(file,href)
            count+=1
    assert count>1000,count


def check_current_appendices(browser,url,root):
    check_local_links(root)
    assert sorted(p.name for p in (root/'dist/lessons').glob('*.html'))==['desktop.html','profiling.html']
    assert not (root/'dist/v1.html').exists()
    for width,theme in [(390,'light'),(390,'dark'),(820,'light'),(820,'dark'),(1440,'light'),(1440,'dark')]:
        with browser.new_context(viewport={'width':width,'height':1000},color_scheme=theme) as context:
            page=context.new_page()
            for slug in ['desktop','profiling']:
                page.goto(url+'lessons/'+slug+'.html')
                expect(page.get_by_role('link',name='CUDA C++ Lab home',exact=True)).to_have_attribute('href','../')
                expect(page.locator('.sidebar')).to_have_count(0)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                expect(page.get_by_role('navigation',name='Breadcrumb')).to_contain_text('Course overview')
                page.screenshot(path=str(root/f'test-results/current-{slug}-{width}-{theme}.png'))
                for href in page.locator('main a[href]').evaluate_all('links=>links.map(a=>a.href)'):
                    if not href.startswith(url):continue
                    response=context.request.get(href.split('#')[0]);assert response.ok,href
            page.goto(url+'lessons/desktop.html')
            expect(page.locator('#desktop-first-kernel')).to_contain_text('nvcc -O2 first-kernel.cu')
            page.get_by_role('link',name='Inspect PyTorch GPU launches',exact=True).first.click()
            expect(page.locator('#dimensions')).to_be_visible()
    with browser.new_context(java_script_enabled=False) as context:
        page=context.new_page();page.goto(url+'lessons/profiling.html')
        expect(page.locator('#profiling-capture')).to_be_visible()
        expect(page.locator('#dimensions')).to_contain_text('inspect-pytorch-trace.py')
    print('PASS: retained setup/profiling appendices, current links, six layouts/themes and static reading',flush=True)
