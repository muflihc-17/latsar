from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import pytz
from app.database import get_db
from app.models import ExecutiveReport, News, NewsAnalysis
from app.services.openai_service import deep_profile

router = APIRouter()

class ReportCreateRequest(BaseModel):
    news_ids: List[str]
    report_type: str = "pagi"  # "pagi" atau "malam"

class ReportUpdateRequest(BaseModel):
    title: str
    content: str

def get_indonesian_date(dt: datetime) -> str:
    days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
    months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
              "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
    day_name = days[dt.weekday()]
    month_name = months[dt.month - 1]
    return f"{day_name} tanggal {dt.day} {month_name} {dt.year}"

@router.post("/generate")
async def generate_report(req: ReportCreateRequest, db: Session = Depends(get_db)):
    """Generate draft laporan WA berdasarkan daftar news_ids dan tipe laporan."""
    if not req.news_ids:
        raise HTTPException(status_code=400, detail="Pilih minimal 1 berita.")

    news_items = db.query(News).filter(News.id.in_(req.news_ids)).all()
    if not news_items:
        raise HTTPException(status_code=404, detail="Berita tidak ditemukan.")

    news_dict = {str(n.id): n for n in news_items}
    ordered_news = [news_dict[nid] for nid in req.news_ids if nid in news_dict]

    tz = pytz.timezone('Asia/Jakarta')
    now = datetime.now(tz)
    yesterday = now - timedelta(days=1)

    date_str_today = get_indonesian_date(now)
    date_str_yesterday = get_indonesian_date(yesterday)

    # Tentukan header laporan berdasarkan tipe
    if req.report_type == "malam":
        greeting = "Sore"
        waktu_patroli = f"hari {date_str_today} pukul 05.00 Wib s.d. pukul 17.00 Wib"
        label_laporan = "Malam"
    else:  # pagi (default)
        greeting = "Pagi"
        waktu_patroli = f"hari {date_str_yesterday} pukul 17.00 Wib s.d. hari {date_str_today} pukul 05.00 Wib"
        label_laporan = "Pagi"

    content = f"""Yth. Pangdam V/Brw

 Cc. 1. Kasdam V/Brw
        2. Asintel Kasdam V/Brw

Selamat {greeting} Bapak Panglima, mohon izin melaporkan telah dilaksanakan Patroli siber pada {waktu_patroli} ditemukan postingan berita Negatif di wilayah Kodam V/Brawijaya yang berpotensi menjadi ancaman stabilitas nasional di wilayah Jawa Timur sbb :

I. Berita Negatif di wilayah Kodam V/Brawijaya yang berpotensi menjadi ancaman stabilitas nasional.
"""

    for idx, n in enumerate(ordered_news, 1):
        analysis = db.query(NewsAnalysis).filter(NewsAnalysis.news_id == n.id).first()
        
        # Jika belum di deep profile, lakukan sekarang
        if not analysis or analysis.profiling_status != "complete" or not analysis.escalation_potential:
            try:
                res = await deep_profile(db, n.id)
                analisa_text = res.get("escalation_potential", "Belum ada analisa spesifik.")
                saran_text = res.get("recommended_action", "Tingkatkan monitoring dan koordinasi wilayah.")
            except Exception as e:
                analisa_text = f"Analisis otomatis gagal ({e})"
                saran_text = "Tingkatkan monitoring dan koordinasi wilayah."
        else:
            analisa_text = analysis.escalation_potential
            saran_text = analysis.recommended_action

        # Membersihkan teks (menghapus formatting markdown jika ada)
        analisa_text = analisa_text.replace("**", "").strip()
        saran_text = saran_text.replace("**", "").strip()

        content += f"""
{idx}) {n.title}
Sumber: {n.url or n.source}

a. Analisa
{analisa_text}

b. Saran
{saran_text}
"""

    content += """
II. UPAYA YANG DILAKUKAN

•  Monitoring di media sosial.

Demikian kami laporkan UMP
"""

    # Buat record laporan baru di database
    new_report = ExecutiveReport(
        title=f"Laporan {label_laporan} Pangdam {now.strftime('%d %b %Y')}",
        content=content.strip(),
        news_ids=req.news_ids
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    return {
        "id": new_report.id,
        "title": new_report.title,
        "content": new_report.content,
        "created_at": new_report.created_at
    }

@router.get("")
def get_reports(db: Session = Depends(get_db)):
    reports = db.query(ExecutiveReport).order_by(ExecutiveReport.created_at.desc()).all()
    return reports

@router.get("/{report_id}")
def get_report(report_id: str, db: Session = Depends(get_db)):
    report = db.query(ExecutiveReport).filter(ExecutiveReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    return report

@router.put("/{report_id}")
def update_report(report_id: str, req: ReportUpdateRequest, db: Session = Depends(get_db)):
    report = db.query(ExecutiveReport).filter(ExecutiveReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    
    report.title = req.title
    report.content = req.content
    db.commit()
    db.refresh(report)
    return report

@router.delete("/{report_id}")
def delete_report(report_id: str, db: Session = Depends(get_db)):
    report = db.query(ExecutiveReport).filter(ExecutiveReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")
    
    db.delete(report)
    db.commit()
    return {"status": "success"}
