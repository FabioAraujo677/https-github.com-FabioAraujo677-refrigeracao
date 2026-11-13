import jsPDF from 'jspdf';
import { CompanySettings, WarrantyOrder } from '../types';
import { formatCurrency, formatDate, formatDateTime } from './formatters';

function triggerDownload(doc: jsPDF, filename: string): boolean {
  try {
    doc.save(filename);
    return true;
  } catch (error) {
    console.error('Error saving PDF:', error);
    // Fallback to blob method if save() fails (though save() is usually better)
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
    } catch (innerError) {
      console.error('Error with blob fallback:', innerError);
      return false;
    }
  }
}

export function downloadWarrantyPdf(order: WarrantyOrder, company: CompanySettings): boolean {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // Outer Decorative Border
    doc.setDrawColor(6, 182, 212); // Cyan 500
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, margin, contentWidth, pageHeight - margin * 2, 4, 4);

    // Top Header Banner
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.roundedRect(margin, margin, contentWidth, 34, 4, 4, 'F');

    // Header Content
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(company.name.toUpperCase(), margin + 5, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(company.slogan, margin + 5, y + 13);

    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    const companyAddress = `${company.street}, ${company.number} - ${company.neighborhood}, ${company.city}/${company.state} - CEP: ${company.cep}`;
    doc.text(companyAddress, margin + 5, y + 18);
    doc.text(
      `CNPJ: ${company.cnpj}  |  Tel: ${company.phone}  |  WhatsApp: ${company.whatsapp}`,
      margin + 5,
      y + 23
    );
    doc.text(`Atendimento: ${company.businessHours}`, margin + 5, y + 28);

    // Right Side Header Badge: OS Number & Date
    doc.setFillColor(8, 145, 178); // Cyan 600
    doc.roundedRect(pageWidth - margin - 50, y + 5, 45, 24, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('CERTIFICADO DE GARANTIA', pageWidth - margin - 47.5, y + 10);
    doc.setFontSize(11);
    doc.text(order.id, pageWidth - margin - 47.5, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Emissão: ${formatDate(order.createdAt)}`, pageWidth - margin - 47.5, y + 24);

    y += 38;

    // Status & Type Bar
    doc.setFillColor(241, 245, 249); // Slate 100
    doc.roundedRect(margin + 2, y, contentWidth - 4, 9, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`TIPO: ${order.orderType === 'agendamento' ? 'AGENDAMENTO DE VISITA' : 'ORDEM DE SERVIÇO & GARANTIA'}`, margin + 6, y + 6);
    doc.setTextColor(13, 148, 136);
    doc.text(`STATUS: ${order.attendanceStatus || 'Concluído'}  |  GARANTIA: ${order.status.toUpperCase()}`, pageWidth - margin - 85, y + 6);

    y += 13;

    // SECTION 1: DADOS DO CLIENTE & LOCALIZAÇÃO
    doc.setFillColor(224, 242, 254); // Light Cyan
    doc.roundedRect(margin + 2, y, contentWidth - 4, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(3, 105, 161);
    doc.text('1. DADOS DO CLIENTE & LOCAL DA INSTALAÇÃO', margin + 6, y + 4.5);

    y += 8;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin + 2, y, contentWidth - 4, 24, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', margin + 6, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(order.customerName, margin + 22, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Telefone:', margin + 110, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(order.customerPhone, margin + 128, y + 6);

    if (order.customerCpf) {
      doc.setFont('helvetica', 'bold');
      doc.text('CPF:', margin + 6, y + 12);
      doc.setFont('helvetica', 'normal');
      doc.text(order.customerCpf, margin + 22, y + 12);
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Endereço:', margin + 6, y + 18);
    doc.setFont('helvetica', 'normal');
    const fullStreet = `${order.street}, ${order.number}${order.complement ? ' (' + order.complement + ')' : ''}`;
    doc.text(fullStreet, margin + 24, y + 18);

    doc.text(`Bairro: ${order.neighborhood}  -  ${order.city}/${order.state}  (CEP: ${order.cep})`, margin + 24, y + 22);

    y += 28;

    // SECTION 2: EQUIPAMENTO & RESPONSÁVEIS
    doc.setFillColor(224, 242, 254);
    doc.roundedRect(margin + 2, y, contentWidth - 4, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(3, 105, 161);
    doc.text('2. APARELHO E EQUIPE TÉCNICA RESPONSÁVEL', margin + 6, y + 4.5);

    y += 8;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin + 2, y, contentWidth - 4, 22, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    doc.setFont('helvetica', 'bold');
    doc.text('Aparelho:', margin + 6, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(order.applianceType, margin + 24, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Marca / Modelo:', margin + 100, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`${order.applianceBrand} ${order.applianceModel || ''}`, margin + 128, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Técnico:', margin + 6, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.text(order.technicianName, margin + 24, y + 13);

    doc.setFont('helvetica', 'bold');
    doc.text('Atendente:', margin + 75, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.text(order.attendantName, margin + 93, y + 13);

    if (order.driverName) {
      doc.setFont('helvetica', 'bold');
      doc.text('Motorista:', margin + 135, y + 13);
      doc.setFont('helvetica', 'normal');
      doc.text(order.driverName, margin + 152, y + 13);
    }

    y += 26;

    // SECTION 3: DETALHES DO SERVIÇO & PEÇAS
    doc.setFillColor(224, 242, 254);
    doc.roundedRect(margin + 2, y, contentWidth - 4, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(3, 105, 161);
    doc.text('3. DETALHES DO REPARO & PEÇAS TROCADAS', margin + 6, y + 4.5);

    y += 8;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin + 2, y, contentWidth - 4, 30, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    doc.setFont('helvetica', 'bold');
    doc.text('Defeito Informado:', margin + 6, y + 6);
    doc.setFont('helvetica', 'normal');
    const splitDefect = doc.splitTextToSize(order.defectDescription || 'Não informado', contentWidth - 45);
    doc.text(splitDefect, margin + 36, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Serviço Realizado:', margin + 6, y + 14);
    doc.setFont('helvetica', 'normal');
    const splitService = doc.splitTextToSize(order.serviceDescription || 'Manutenção técnica geral', contentWidth - 45);
    doc.text(splitService, margin + 36, y + 14);

    doc.setFont('helvetica', 'bold');
    doc.text('Peça(s) Trocada(s):', margin + 6, y + 23);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 83, 9); // Amber / orange emphasis
    const splitParts = doc.splitTextToSize(order.partsReplaced || 'Nenhuma (Ajuste ou Reparo de fiação)', contentWidth - 45);
    doc.text(splitParts, margin + 36, y + 23);

    y += 34;

    // SECTION 4: VALOR, PAGAMENTO E GARANTIA
    doc.setFillColor(15, 23, 42); // Dark slate
    doc.roundedRect(margin + 2, y, contentWidth - 4, 28, 3, 3, 'F');

    // Left: Valor & Pagamento
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('VALOR TOTAL DO SERVIÇO', margin + 8, y + 8);
    doc.setFontSize(16);
    doc.setTextColor(56, 189, 248); // Cyan
    doc.text(formatCurrency(order.totalValue), margin + 8, y + 17);

    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text(`Forma: ${order.paymentMethod} (${order.paymentStatus})`, margin + 8, y + 23);

    // Right: Garantia em Destaque
    doc.setFillColor(8, 145, 178); // Cyan Box
    doc.roundedRect(pageWidth - margin - 75, y + 3.5, 70, 21, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('PRAZO DE GARANTIA ASSEGURADO', pageWidth - margin - 72, y + 8.5);
    doc.setFontSize(14);
    doc.text(`${order.warrantyMonths} MESES DE GARANTIA`, pageWidth - margin - 72, y + 15);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Válida até: ${formatDate(order.warrantyEndDate)}`, pageWidth - margin - 72, y + 21);

    y += 33;

    // SECTION 5: TERMOS DA GARANTIA
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin + 2, y, contentWidth - 4, 24, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text('TERMOS E CONDIÇÕES DA GARANTIA:', margin + 6, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    const terms = (company.warrantyTerms || 'A garantia cobre a peça e mão de obra trocada.')
      .split('\n')
      .slice(0, 4);
    terms.forEach((line, idx) => {
      doc.text(line, margin + 6, y + 9.5 + idx * 3.5);
    });

    y += 28;

    // SECTION 6: ASSINATURAS
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);

    // Technician signature line
    doc.line(margin + 10, y + 16, margin + 80, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(order.technicianName, margin + 12, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Assinatura do Técnico Responsável', margin + 12, y + 23.5);

    // Customer signature line
    doc.line(pageWidth - margin - 80, y + 16, pageWidth - margin - 10, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(order.customerName, pageWidth - margin - 78, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Assinatura / Concordância do Cliente', pageWidth - margin - 78, y + 23.5);

    if (order.clientSignature && order.clientSignature.startsWith('data:image')) {
      try {
        doc.addImage(order.clientSignature, 'PNG', pageWidth - margin - 75, y + 3, 50, 12);
      } catch (e) {
        // signature draw fallback
      }
    }

    // Bottom Footer
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Documento autenticado eletronicamente em ${formatDateTime(order.createdAt)}  •  OS: ${order.id}`,
      margin + 6,
      pageHeight - margin - 2
    );

    const safeCustomer = order.customerName.replace(/[^a-zA-Z0-9]/g, '_');
    return triggerDownload(doc, `Garantia_${order.id}_${safeCustomer}.pdf`);
  } catch (error) {
    console.error('Falha ao gerar PDF de garantia:', error);
    return false;
  }
}

export function downloadSchedulePdf(order: WarrantyOrder, company: CompanySettings): boolean {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // Outer Border
    doc.setDrawColor(168, 85, 247); // Purple 500
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, margin, contentWidth, pageHeight - margin * 2, 4, 4);

    // Header Banner
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, margin, contentWidth, 34, 4, 4, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(company.name.toUpperCase(), margin + 5, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(company.slogan, margin + 5, y + 13);

    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    const companyAddress = `${company.street}, ${company.number} - ${company.neighborhood}, ${company.city}/${company.state}`;
    doc.text(companyAddress, margin + 5, y + 18);
    doc.text(`Tel: ${company.phone}  |  WhatsApp: ${company.whatsapp}`, margin + 5, y + 23);
    doc.text(`Atendimento: ${company.businessHours}`, margin + 5, y + 28);

    // Right Badge: Agendamento de Visita
    doc.setFillColor(147, 51, 234); // Purple 600
    doc.roundedRect(pageWidth - margin - 52, y + 5, 48, 24, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('AGENDAMENTO DE VISITA', pageWidth - margin - 50, y + 10);
    doc.setFontSize(11);
    doc.text(order.id, pageWidth - margin - 50, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Criado em: ${formatDate(order.createdAt)}`, pageWidth - margin - 50, y + 24);

    y += 38;

    // Visita Highlight Banner
    doc.setFillColor(243, 232, 255); // Purple 100
    doc.roundedRect(margin + 2, y, contentWidth - 4, 15, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(107, 33, 168);
    const dateStr = order.scheduledDate ? formatDate(order.scheduledDate) : 'A Definir';
    const timeStr = order.scheduledTime || 'Horário Comercial';
    doc.text(`DATA DA VISITA TÉCNICA: ${dateStr}  |  HORÁRIO: ${timeStr}`, margin + 6, y + 6);
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text(
      `Taxa de Avaliação / Visita: ${order.visitFee ? formatCurrency(order.visitFee) : 'Isento na aprovação'}  |  Status: ${order.attendanceStatus || 'Na fila / Aguardando'}`,
      margin + 6,
      y + 11
    );

    y += 19;

    // SECTION 1: DADOS DO CLIENTE
    doc.setFillColor(243, 232, 255);
    doc.roundedRect(margin + 2, y, contentWidth - 4, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(107, 33, 168);
    doc.text('1. DADOS DO CLIENTE & ENDEREÇO DA VISITA', margin + 6, y + 4.5);

    y += 8;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin + 2, y, contentWidth - 4, 25, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', margin + 6, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(order.customerName, margin + 22, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Telefone:', margin + 110, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(order.customerPhone, margin + 128, y + 6);

    if (order.customerCpf) {
      doc.setFont('helvetica', 'bold');
      doc.text('CPF:', margin + 6, y + 12);
      doc.setFont('helvetica', 'normal');
      doc.text(order.customerCpf, margin + 22, y + 12);
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Endereço:', margin + 6, y + 18);
    doc.setFont('helvetica', 'normal');
    const fullStreet = `${order.street}, ${order.number}${order.complement ? ' (' + order.complement + ')' : ''}`;
    doc.text(fullStreet, margin + 24, y + 18);

    doc.text(`Bairro: ${order.neighborhood}  -  ${order.city}/${order.state}  (CEP: ${order.cep})`, margin + 24, y + 22.5);

    y += 29;

    // SECTION 2: EQUIPAMENTO & EQUIPE
    doc.setFillColor(243, 232, 255);
    doc.roundedRect(margin + 2, y, contentWidth - 4, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(107, 33, 168);
    doc.text('2. APARELHO A SER AVALIADO & RESPONSÁVEIS', margin + 6, y + 4.5);

    y += 8;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin + 2, y, contentWidth - 4, 24, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    doc.setFont('helvetica', 'bold');
    doc.text('Aparelho:', margin + 6, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(order.applianceType, margin + 24, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Marca / Modelo:', margin + 100, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`${order.applianceBrand} ${order.applianceModel || ''}`, margin + 128, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Técnico Escalado:', margin + 6, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.text(order.technicianName, margin + 34, y + 13);

    doc.setFont('helvetica', 'bold');
    doc.text('Atendente:', margin + 78, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.text(order.attendantName, margin + 98, y + 13);

    if (order.driverName) {
      doc.setFont('helvetica', 'bold');
      doc.text('Motorista:', margin + 135, y + 13);
      doc.setFont('helvetica', 'normal');
      doc.text(order.driverName, margin + 152, y + 13);
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Sintoma / Defeito:', margin + 6, y + 20);
    doc.setFont('helvetica', 'normal');
    const splitDefect = doc.splitTextToSize(order.defectDescription || 'Avaliação no local', contentWidth - 45);
    doc.text(splitDefect, margin + 34, y + 20);

    y += 28;

    // INSTRUÇÕES DA VISITA
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin + 2, y, contentWidth - 4, 26, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('INFORMAÇÕES IMPORTANTES AO CLIENTE:', margin + 6, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text('• Solicitamos a presença de um responsável maior de 18 anos no local durante a visita técnica.', margin + 6, y + 10);
    doc.text('• Em caso de necessidade de remarcação, favor nos avisar com antecedência mínima de 2 horas.', margin + 6, y + 14.5);
    doc.text('• O orçamento é detalhado e qualquer serviço aprovado conta com garantia assegurada por escrito.', margin + 6, y + 19);
    doc.text(`• Central de atendimento: ${company.phone} / WhatsApp: ${company.whatsapp}`, margin + 6, y + 23.5);

    y += 32;

    // ASSINATURAS
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);

    doc.line(margin + 10, y + 16, margin + 80, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(order.technicianName, margin + 12, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Técnico Escalado', margin + 12, y + 23.5);

    doc.line(pageWidth - margin - 80, y + 16, pageWidth - margin - 10, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(order.customerName, pageWidth - margin - 78, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Cliente Solicitante', pageWidth - margin - 78, y + 23.5);

    if (order.clientSignature && order.clientSignature.startsWith('data:image')) {
      try {
        doc.addImage(order.clientSignature, 'PNG', pageWidth - margin - 75, y + 3, 50, 12);
      } catch (e) {}
    }

    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Agendamento emitido via sistema em ${formatDateTime(order.createdAt)}  •  OS: ${order.id}`,
      margin + 6,
      pageHeight - margin - 2
    );

    const safeCustomer = order.customerName.replace(/[^a-zA-Z0-9]/g, '_');
    return triggerDownload(doc, `Agendamento_Visita_${order.id}_${safeCustomer}.pdf`);
  } catch (error) {
    console.error('Falha ao gerar PDF de agendamento:', error);
    return false;
  }
}

export function downloadOrderServicePdf(order: WarrantyOrder, company: CompanySettings): boolean {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const companyTitle = (company.name || 'NEO FIX ELETRÔNICA & REFRIGERAÇÃO').toUpperCase();
    const companySlogan = company.slogan || 'Assistência Técnica Especializada em Eletrodomésticos';
    const addressLine = [
      company.street && company.number ? `${company.street}, ${company.number}` : company.street,
      company.neighborhood,
      company.city && company.state ? `${company.city}/${company.state}` : company.city || '',
      company.cep ? `CEP: ${company.cep}` : '',
    ]
      .filter(Boolean)
      .join(' - ');

    // Crisp outer border on white sheet
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, margin, contentWidth, pageHeight - margin * 2, 3, 3);

    // Clean Header (high-contrast monochrome-friendly header)
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, margin, contentWidth, 32, 3, 3, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, margin + 32, pageWidth - margin, margin + 32);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.text(companyTitle, margin + 5, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(companySlogan, margin + 5, y + 13);

    doc.setFontSize(7.5);
    if (addressLine) {
      doc.text(addressLine, margin + 5, y + 18.5);
    }
    doc.text(
      `CNPJ: ${company.cnpj || '-'}  |  Tel: ${company.phone || '-'}  |  WhatsApp: ${company.whatsapp || '-'}`,
      margin + 5,
      y + 23.5
    );
    doc.text(`Horário: ${company.businessHours || 'Seg a Sáb'}`, margin + 5, y + 28.5);

    // Right Box: Número da OS
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(pageWidth - margin - 52, y + 4, 48, 24, 2.5, 2.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('ORDEM DE SERVIÇO', pageWidth - margin - 49, y + 9.5);
    doc.setFontSize(11);
    doc.text(String(order.id || 'OS'), pageWidth - margin - 49, y + 16.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Emissão: ${formatDate(order.createdAt)}`, pageWidth - margin - 49, y + 23.5);

    y += 36;

    // Bar: Data, Horário & Status
    const schedDateStr = order.scheduledDate ? formatDate(order.scheduledDate) : formatDate(order.createdAt);
    const schedTimeStr = order.scheduledTime || 'Horário Comercial';
    const docTypeStr = order.orderType === 'agendamento' ? 'AGENDAMENTO / VISITA TÉCNICA' : 'ORDEM DE SERVIÇO / GARANTIA';

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin + 3, y, contentWidth - 6, 13, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`DATA: ${schedDateStr}   |   HORÁRIO: ${schedTimeStr}`, margin + 7, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Tipo: ${docTypeStr}   |   Status: ${order.attendanceStatus || 'Na fila / Aguardando'}`, margin + 7, y + 10.5);

    y += 17;

    // 1. DADOS DO CLIENTE
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(margin + 3, y, contentWidth - 6, 6.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('1. DADOS DO CLIENTE', margin + 7, y + 4.5);

    y += 8.5;
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin + 3, y, contentWidth - 6, 25, 2, 2, 'S');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);

    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', margin + 7, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(order.customerName || 'Não informado', margin + 23, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Telefone / WhatsApp:', margin + 108, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(order.customerPhone || '-', margin + 141, y + 6);

    if (order.customerCpf) {
      doc.setFont('helvetica', 'bold');
      doc.text('CPF:', margin + 7, y + 12);
      doc.setFont('helvetica', 'normal');
      doc.text(order.customerCpf, margin + 23, y + 12);
    }

    const streetText = [
      order.street || '',
      order.number || '',
      order.complement ? `(${order.complement})` : '',
    ]
      .filter(Boolean)
      .join(', ');
    const cityText = [
      order.neighborhood || '',
      order.city ? `${order.city}/${order.state || ''}` : '',
      order.cep ? `CEP: ${order.cep}` : '',
    ]
      .filter(Boolean)
      .join(' - ');

    doc.setFont('helvetica', 'bold');
    doc.text('Endereço:', margin + 7, y + 17.5);
    doc.setFont('helvetica', 'normal');
    doc.text(streetText || 'Não informado', margin + 24, y + 17.5);
    if (cityText) {
      doc.text(cityText, margin + 24, y + 22.5);
    }

    y += 29;

    // 2. APARELHO & RESPONSÁVEL TÉCNICO
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(margin + 3, y, contentWidth - 6, 6.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('2. APARELHO & RESPONSÁVEL TÉCNICO', margin + 7, y + 4.5);

    y += 8.5;
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin + 3, y, contentWidth - 6, 20, 2, 2, 'S');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);

    doc.setFont('helvetica', 'bold');
    doc.text('Aparelho:', margin + 7, y + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(order.applianceType || 'Eletrodoméstico', margin + 25, y + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.text('Marca / Modelo:', margin + 100, y + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${order.applianceBrand || '-'} ${order.applianceModel || ''}`.trim(), margin + 128, y + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.text('Técnico Responsável:', margin + 7, y + 14);
    doc.setFont('helvetica', 'normal');
    doc.text(order.technicianName || 'Não escalado', margin + 42, y + 14);

    doc.setFont('helvetica', 'bold');
    doc.text('Atendente:', margin + 108, y + 14);
    doc.setFont('helvetica', 'normal');
    doc.text(order.attendantName || 'Central', margin + 127, y + 14);

    y += 24;

    // 3. DEFEITO RELATADO & SERVIÇO
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(margin + 3, y, contentWidth - 6, 6.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('3. DEFEITO RELATADO & DESCRIÇÃO DO ATENDIMENTO', margin + 7, y + 4.5);

    y += 8.5;
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin + 3, y, contentWidth - 6, 36, 2, 2, 'S');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);

    doc.setFont('helvetica', 'bold');
    doc.text('Defeito Relatado:', margin + 7, y + 6.5);
    doc.setFont('helvetica', 'normal');
    const defectLines = doc.splitTextToSize(order.defectDescription || 'Não informado', contentWidth - 44).slice(0, 2);
    doc.text(defectLines, margin + 37, y + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.text('Serviço / Obs.:', margin + 7, y + 18);
    doc.setFont('helvetica', 'normal');
    const serviceLines = doc.splitTextToSize(order.serviceDescription || 'Diagnóstico e reparo técnico', contentWidth - 44).slice(0, 2);
    doc.text(serviceLines, margin + 37, y + 18);

    doc.setFont('helvetica', 'bold');
    doc.text('Peças Trocadas:', margin + 7, y + 29.5);
    doc.setFont('helvetica', 'normal');
    const partsLines = doc.splitTextToSize(order.partsReplaced || 'A definir / Sem troca registrada', contentWidth - 44).slice(0, 1);
    doc.text(partsLines, margin + 37, y + 29.5);

    y += 40;

    // 4. VALOR & GARANTIA
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(15, 23, 42);
    doc.roundedRect(margin + 3, y, contentWidth - 6, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('VALOR DO SERVIÇO / VISITA', margin + 8, y + 6.5);

    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrency(Number(order.totalValue || 0)), margin + 8, y + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(
      `Pagamento: ${order.paymentMethod || 'Pix'} (${order.paymentStatus || 'Pendente'})`,
      margin + 72,
      y + 10
    );
    doc.text(
      `Garantia: ${order.warrantyMonths || 3} meses${order.warrantyEndDate ? ` • Válida até ${formatDate(order.warrantyEndDate)}` : ''}`,
      margin + 72,
      y + 16
    );

    y += 28;

    // 5. CAMPO DE ASSINATURAS
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('5. ASSINATURAS DE CONCORDÂNCIA', margin + 5, y + 3);

    y += 6;
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.4);

    // Assinatura Técnico
    doc.line(margin + 10, y + 18, margin + 80, y + 18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(order.technicianName || 'Técnico Responsável', margin + 12, y + 22.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Assinatura do Técnico Responsável', margin + 12, y + 26.5);

    // Assinatura Cliente
    doc.line(pageWidth - margin - 80, y + 18, pageWidth - margin - 10, y + 18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(order.customerName || 'Cliente', pageWidth - margin - 78, y + 22.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Assinatura do Cliente / Responsável', pageWidth - margin - 78, y + 26.5);

    if (order.clientSignature && order.clientSignature.startsWith('data:image')) {
      try {
        doc.addImage(order.clientSignature, 'PNG', pageWidth - margin - 72, y + 4, 48, 13);
      } catch {}
    }

    // Rodapé
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${companyTitle}  •  OS: ${order.id}  •  Emitido em ${formatDateTime(order.createdAt)}`,
      margin + 6,
      pageHeight - margin - 3
    );

    const safeCustomer = (order.customerName || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
    return triggerDownload(doc, `OS_${order.id}_${safeCustomer}.pdf`);
  } catch (error) {
    console.error('Falha ao gerar PDF da OS:', error);
    return false;
  }
}

