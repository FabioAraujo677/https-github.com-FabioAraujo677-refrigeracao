import jsPDF from 'jspdf';
import { CarneSale, CompanySettings } from '../types';
import { formatCurrency, formatDate } from './formatters';

function loadImageDimensions(src: string): Promise<{ width: number; height: number; format: 'JPEG' | 'PNG' }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const isPng = src.startsWith('data:image/png');
      resolve({
        width: img.naturalWidth || 1000,
        height: img.naturalHeight || 500,
        format: isPng ? 'PNG' : 'JPEG',
      });
    };
    img.onerror = () => resolve({ width: 1000, height: 500, format: 'JPEG' });
    img.src = src;
  });
}

function triggerCarneDownload(doc: jsPDF, filename: string): boolean {
  try {
    doc.save(filename);
    return true;
  } catch (err) {
    console.warn('Fallback blob download for Carnê PDF:', err);
    try {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1500);
      return true;
    } catch (innerErr) {
      console.error('Erro ao baixar PDF do carnê:', innerErr);
      return false;
    }
  }
}

export async function downloadCarnePdf(carne: CarneSale, company: CompanySettings): Promise<boolean> {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;

    // ==================== PÁGINA 1: CAPA DO CARNÊ ====================
    doc.setDrawColor(6, 182, 212);
    doc.setLineWidth(0.7);
    doc.roundedRect(margin, margin, contentWidth, pageHeight - margin * 2, 4, 4);

    let y = margin + 4;

    if (carne.coverImage) {
      // Exibe imagem personalizada enviada pelo administrador como capa do carnê
      const boxW = contentWidth - 8;
      const boxH = 92;
      const boxX = margin + 4;

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(boxX, y, boxW, boxH, 3, 3, 'F');

      const { width: natW, height: natH, format } = await loadImageDimensions(carne.coverImage);
      const ratio = Math.min((boxW - 4) / natW, (boxH - 4) / natH);
      const drawW = natW * ratio;
      const drawH = natH * ratio;
      const drawX = boxX + (boxW - drawW) / 2;
      const drawY = y + (boxH - drawH) / 2;

      doc.addImage(carne.coverImage, format, drawX, drawY, drawW, drawH);
      y += boxH + 6;
    } else {
      // Layout elegante padrão da NEO FIX ELETRÔNICA & REFRIGERAÇÃO
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin + 4, y, contentWidth - 8, 66, 3, 3, 'F');

      doc.setFillColor(6, 182, 212);
      doc.roundedRect(margin + 4, y, contentWidth - 8, 4, 2, 2, 'F');

      doc.setTextColor(34, 211, 238);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('CARNÊ DE PAGAMENTO / CREDIÁRIO PRÓPRIO', pageWidth / 2, y + 14, { align: 'center' });

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(17);
      doc.text((company.name || 'NEO FIX ELETRÔNICA & REFRIGERAÇÃO').toUpperCase(), pageWidth / 2, y + 25, { align: 'center' });

      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(company.slogan || 'Assistência Técnica & Vendas Especializadas', pageWidth / 2, y + 32, { align: 'center' });

      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.4);
      doc.line(margin + 18, y + 38, pageWidth - margin - 18, y + 38);

      doc.setTextColor(203, 213, 225);
      doc.setFontSize(8);
      doc.text(
        `CNPJ: ${company.cnpj}  •  Tel: ${company.phone}  •  WhatsApp: ${company.whatsapp}`,
        pageWidth / 2,
        y + 46,
        { align: 'center' }
      );
      doc.text(
        `${company.street}, ${company.number} - ${company.neighborhood}, ${company.city}/${company.state}`,
        pageWidth / 2,
        y + 52,
        { align: 'center' }
      );
      doc.setTextColor(52, 211, 153);
      doc.setFont('helvetica', 'bold');
      doc.text(`Nº DO CARNÊ: ${carne.id}   •   EMISSÃO: ${formatDate(carne.createdAt)}`, pageWidth / 2, y + 60, {
        align: 'center',
      });

      y += 72;
    }

    // Título da ficha da capa
    doc.setFillColor(224, 242, 254);
    doc.roundedRect(margin + 4, y, contentWidth - 8, 8, 2, 2, 'F');
    doc.setTextColor(3, 105, 161);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`IDENTIFICAÇÃO DO CARNÊ  •  ${carne.id}`, margin + 8, y + 5.5);
    doc.text(`EMISSÃO: ${formatDate(carne.createdAt)}`, pageWidth - margin - 8, y + 5.5, { align: 'right' });

    y += 12;

    // Bloco com dados do cliente & compra
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin + 4, y, contentWidth - 8, 44, 2.5, 2.5, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);

    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', margin + 8, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(carne.customerName, margin + 28, y + 8);

    doc.setFont('helvetica', 'bold');
    doc.text('WhatsApp / Tel:', margin + 112, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(carne.customerPhone, margin + 140, y + 8);

    doc.setFont('helvetica', 'bold');
    doc.text('Produto / Serviço:', margin + 8, y + 16);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(carne.description, contentWidth - 46);
    doc.text(descLines.slice(0, 2), margin + 40, y + 16);

    // Caixas de resumo financeiro
    const cardY = y + 26;
    const cardW = (contentWidth - 20) / 3;

    // Valor Total
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin + 8, cardY, cardW, 14, 2, 2, 'F');
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('VALOR TOTAL', margin + 11, cardY + 5);
    doc.setTextColor(52, 211, 153);
    doc.setFontSize(11);
    doc.text(formatCurrency(carne.totalValue), margin + 11, cardY + 11.5);

    // Parcelas
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin + 10 + cardW, cardY, cardW, 14, 2, 2, 'F');
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.text('PARCELAMENTO', margin + 13 + cardW, cardY + 5);
    doc.setTextColor(34, 211, 238);
    doc.setFontSize(11);
    doc.text(
      `${carne.installmentsCount}x de ${formatCurrency(carne.installmentValue)}`,
      margin + 13 + cardW,
      cardY + 11.5
    );

    // 1º Vencimento
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin + 12 + cardW * 2, cardY, cardW, 14, 2, 2, 'F');
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.text('1º VENCIMENTO', margin + 15 + cardW * 2, cardY + 5);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.text(formatDate(carne.firstDueDate), margin + 15 + cardW * 2, cardY + 11.5);

    y += 50;

    // Tabela Resumo de Vencimentos na Capa
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin + 4, y, contentWidth - 8, 7, 1.5, 1.5, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('DEMONSTRATIVO DAS PARCELAS', margin + 8, y + 4.8);
    y += 9;

    const colW = (contentWidth - 12) / 2;
    const rowsPerCol = Math.ceil(carne.installments.length / 2);
    doc.setFontSize(7.8);

    carne.installments.forEach((inst, idx) => {
      const col = idx < rowsPerCol ? 0 : 1;
      const row = col === 0 ? idx : idx - rowsPerCol;
      const rx = margin + 4 + col * (colW + 4);
      const ry = y + row * 7.2;

      if (ry > pageHeight - margin - 20) return;

      doc.setFillColor(row % 2 === 0 ? 255 : 248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(rx, ry, colW, 6.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const numLabel = `${String(inst.number).padStart(2, '0')}/${String(inst.total).padStart(2, '0')}`;
      doc.text(`Parcela ${numLabel}`, rx + 3, ry + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Venc: ${formatDate(inst.dueDate)}`, rx + 30, ry + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(inst.paid ? 5 : 15, inst.paid ? 150 : 23, inst.paid ? 105 : 42);
      doc.text(
        `${formatCurrency(inst.amount)}${inst.paid ? ' (PAGO)' : ''}`,
        rx + colW - 3,
        ry + 4.5,
        { align: 'right' }
      );
    });

    // Rodapé da Capa
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(
      `${company.name}  •  Tel/WhatsApp: ${company.phone}  •  Apresente a lâmina correspondente no ato do pagamento.`,
      pageWidth / 2,
      pageHeight - margin - 5,
      { align: 'center' }
    );

    // ==================== PÁGINAS SEGUINTES: LÂMINAS DAS PARCELAS ====================
    const slipsPerPage = 3;
    const slipHeight = 82;
    const slipGap = 8;
    const stubWidth = 58;
    const mainWidth = contentWidth - stubWidth;

    carne.installments.forEach((inst, index) => {
      const slotIndex = index % slipsPerPage;
      if (slotIndex === 0) {
        doc.addPage();
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(
          `LÂMINAS DE PAGAMENTO  •  CARNÊ ${carne.id}  •  CLIENTE: ${carne.customerName.toUpperCase()}`,
          pageWidth / 2,
          margin - 3,
          { align: 'center' }
        );
      }

      const sy = margin + slotIndex * (slipHeight + slipGap);
      const parcelCode = `${String(inst.number).padStart(2, '0')}/${String(inst.total).padStart(2, '0')}`;

      // Borda externa da lâmina
      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.45);
      doc.roundedRect(margin, sy, contentWidth, slipHeight, 2.5, 2.5);

      // Linha tracejada separando Canhoto (esquerda) e Recibo do Cliente (direita)
      doc.setLineDashPattern([2, 2], 0);
      doc.setDrawColor(148, 163, 184);
      doc.line(margin + stubWidth, sy + 2, margin + stubWidth, sy + slipHeight - 2);
      doc.setLineDashPattern([], 0);

      // ---- CANHOTO DA LOJA (ESQUERDA) ----
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, sy, stubWidth, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('CONTROLE DA LOJA', margin + 3, sy + 5);
      doc.setTextColor(34, 211, 238);
      doc.setFontSize(8.5);
      doc.text(`PARCELA ${parcelCode}`, margin + 3, sy + 10);

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text('Carnê:', margin + 3, sy + 18);
      doc.setFont('helvetica', 'normal');
      doc.text(carne.id, margin + 14, sy + 18);

      doc.setFont('helvetica', 'bold');
      doc.text('Cliente:', margin + 3, sy + 24);
      doc.setFont('helvetica', 'normal');
      const stubCustomer = doc.splitTextToSize(carne.customerName, stubWidth - 6);
      doc.text(stubCustomer.slice(0, 2), margin + 3, sy + 28.5);

      doc.setFont('helvetica', 'bold');
      doc.text('Vencimento:', margin + 3, sy + 40);
      doc.setFontSize(9);
      doc.setTextColor(180, 83, 9);
      doc.text(formatDate(inst.dueDate), margin + 3, sy + 45);

      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('Valor:', margin + 3, sy + 53);
      doc.setFontSize(10);
      doc.setTextColor(5, 150, 105);
      doc.text(formatCurrency(inst.amount), margin + 3, sy + 58.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      if (inst.paid) {
        doc.setTextColor(5, 150, 105);
        doc.setFont('helvetica', 'bold');
        doc.text(`PAGO EM: ${inst.paidAt ? formatDate(inst.paidAt) : 'CONFIRMADO'}`, margin + 3, sy + 68);
      } else {
        doc.text('Pagto: ____/____/______', margin + 3, sy + 68);
        doc.text('Visto: ________________', margin + 3, sy + 76);
      }

      // ---- LÂMINA PRINCIPAL DO CLIENTE (DIREITA) ----
      const mx = margin + stubWidth;

      doc.setFillColor(15, 23, 42);
      doc.rect(mx, sy, mainWidth, 14, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text((company.name || 'NEO FIX ELETRÔNICA & REFRIGERAÇÃO').toUpperCase(), mx + 4, sy + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Tel/WhatsApp: ${company.phone}  •  Carnê Nº ${carne.id}`, mx + 4, sy + 11);

      // Badge da Parcela no canto direito da lâmina
      doc.setFillColor(6, 182, 212);
      doc.roundedRect(mx + mainWidth - 36, sy + 2.5, 33, 9, 1.5, 1.5, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(`PARCELA ${parcelCode}`, mx + mainWidth - 19.5, sy + 8.3, { align: 'center' });

      // Linha de Dados do Cliente
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text('Pagador / Cliente:', mx + 4, sy + 22);
      doc.setFont('helvetica', 'normal');
      doc.text(`${carne.customerName}  (${carne.customerPhone})`, mx + 34, sy + 22);

      doc.setFont('helvetica', 'bold');
      doc.text('Referente a:', mx + 4, sy + 29);
      doc.setFont('helvetica', 'normal');
      const slipDesc = doc.splitTextToSize(carne.description, mainWidth - 28);
      doc.text(slipDesc.slice(0, 2), mx + 25, sy + 29);

      // Caixas de Vencimento e Valor
      const boxTop = sy + 39;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(mx + 4, boxTop, 56, 17, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('DATA DE VENCIMENTO', mx + 7, boxTop + 5);
      doc.setFontSize(12);
      doc.setTextColor(180, 83, 9);
      doc.text(formatDate(inst.dueDate), mx + 7, boxTop + 13);

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(mx + 64, boxTop, 56, 17, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('VALOR DA PARCELA', mx + 67, boxTop + 5);
      doc.setFontSize(12);
      doc.setTextColor(5, 150, 105);
      doc.text(formatCurrency(inst.amount), mx + 67, boxTop + 13);

      // Controle de Quitação / Assinatura na Lâmina
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(mx + 4, sy + 60, mainWidth - 8, 17, 2, 2, 'S');
      doc.setFontSize(7.5);
      if (inst.paid) {
        doc.setTextColor(5, 150, 105);
        doc.setFont('helvetica', 'bold');
        doc.text(
          `[ PAGO ] Quitado em ${inst.paidAt ? formatDate(inst.paidAt) : formatDate(new Date().toISOString())}`,
          mx + 8,
          sy + 68
        );
      } else {
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
        doc.text('CONTROLE DE PAGAMENTO:', mx + 7, sy + 65.5);
        doc.setFont('helvetica', 'normal');
        doc.text('Data Pagto: ____/____/______', mx + 7, sy + 73);
        doc.text('Recebido por / Assinatura: ___________________________', mx + 52, sy + 73);
      }

      // Linha de corte entre lâminas
      if (slotIndex < slipsPerPage - 1 && index < carne.installments.length - 1) {
        const cutY = sy + slipHeight + slipGap / 2;
        doc.setLineDashPattern([3, 3], 0);
        doc.setDrawColor(148, 163, 184);
        doc.line(margin, cutY, pageWidth - margin, cutY);
        doc.setLineDashPattern([], 0);
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text('CORTE AQUI', pageWidth - margin - 18, cutY - 1);
      }
    });

    const safeCustomer = (carne.customerName || 'Cliente')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '_');

    return triggerCarneDownload(doc, `Carne_${carne.id}_${safeCustomer}.pdf`);
  } catch (err) {
    console.error('Erro ao gerar PDF do Carnê:', err);
    return false;
  }
}
