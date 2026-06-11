import { supabase } from './supabase';
import { EmailLog } from '../types';

export async function sendFinishedOSReport(orderId: string): Promise<{ success: boolean; data?: EmailLog; error?: string }> {
  try {
    // 1. Fetch Service Order
    const { data: os, error: osError } = await supabase
      .from('service_orders')
      .eq('id', orderId)
      .single();

    if (osError || !os) {
      throw new Error(osError?.message || 'Ordem de serviço não encontrada.');
    }

    // 2. Fetch Customer Details
    const { data: customer } = await supabase
      .from('customers')
      .eq('id', os.customer_id)
      .single();

    // 3. Fetch Machine Details
    const { data: machine } = await supabase
      .from('machines')
      .eq('id', os.machine_id)
      .single();

    // 4. Fetch Used Parts
    const { data: usedParts } = await supabase
      .from('used_parts')
      .eq('service_order_id', orderId);

    // 5. Fetch Checklist Answers & Items (for preventive)
    let checklistDetails: { label: string; answer: 'ok' | 'pending' }[] = [];
    if (os.is_preventive) {
      const [{ data: answers }, { data: items }] = await Promise.all([
        supabase.from('preventive_checklist_answers').select('*').eq('service_order_id', orderId),
        supabase.from('preventive_checklist_items').select('*')
      ]);

      if (items && answers) {
        checklistDetails = items.map((item: any) => {
          const matchedAnswer = answers.find((ans: any) => ans.item_id === item.id);
          return {
            label: item.label,
            answer: matchedAnswer ? matchedAnswer.answer : 'pending'
          };
        });
      }
    }

    // 6. Fetch Photos
    const { data: photos } = await supabase
      .from('service_order_photos')
      .eq('service_order_id', orderId);

    const rawRecipient = customer?.contact_email || 'raoniespin@gmail.com';
    const recipient = rawRecipient.toLowerCase().trim();
    const customerName = customer?.name || 'Cliente';
    const subject = `[PD MANUTENÇÃO] Relatório de Serviço Concluído - OS #${os.id.substring(0, 8).toUpperCase()}`;

    // ——— BUILD BEAUTIFUL HTML TEMPLATE ———
    const formatDate = (isoString: string | null) => {
      if (!isoString) return '—';
      return new Date(isoString).toLocaleString('pt-BR');
    };

    // Style helper colors
    const primaryColor = '#121414';
    const accentColor = '#caf300';
    const successColor = '#00c853';
    
    // Build Checklist HTML
    let checklistHtml = '';
    if (os.is_preventive && checklistDetails.length > 0) {
      const opinion = os.preventive_opinion || 'NÃO DEFINIDO';
      const opinionColor = opinion === 'LIBERADO' ? '#15803d' : opinion === 'BLOQUEADO' ? '#b91c1c' : '#64748b';
      const opinionBg = opinion === 'LIBERADO' ? '#dcfce7' : opinion === 'BLOQUEADO' ? '#fee2e2' : '#f1f5f9';

      checklistHtml = `
        <div style="margin-top: 25px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: ${primaryColor}; color: #ffffff; padding: 12px 16px; font-weight: bold; font-size: 14px; text-transform: uppercase;">
            📋 Questionário de Manutenção Preventiva
            <span style="float: right; font-size: 11px; background-color: ${opinionBg}; color: ${opinionColor}; padding: 2px 8px; border-radius: 4px; font-weight: bold; border: 1px solid ${opinionColor}40; margin-left: 10px;">
              PARECER: ${opinion}
            </span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: left;">
                <th style="padding: 10px 16px; color: #64748b;">Item Verificado</th>
                <th style="padding: 10px 16px; text-align: center; color: #64748b; width: 140px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${checklistDetails.map(item => {
                const isOk = item.answer === 'ok';
                const statusLabel = isOk ? '✓ CONFORME' : '✗ PENDENTE';
                const statusBg = isOk ? '#dcfce7' : '#fee2e2';
                const statusColor = isOk ? '#15803d' : '#b91c1c';
                return `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 16px; color: #334155;">${item.label}</td>
                    <td style="padding: 10px 16px; text-align: center;">
                      <span style="background-color: ${statusBg}; color: ${statusColor}; font-weight: bold; padding: 4px 8px; border-radius: 4px; font-size: 11px; display: inline-block;">
                        ${statusLabel}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Build Used Parts HTML
    let partsHtml = '';
    const partsList = usedParts || [];
    if (partsList.length > 0) {
      partsHtml = `
        <div style="margin-top: 25px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: ${primaryColor}; color: #ffffff; padding: 12px 16px; font-weight: bold; font-size: 14px; text-transform: uppercase;">
            ⚙️ Peças e Insumos Utilizados
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: left;">
                <th style="padding: 10px 16px; color: #64748b;">Código / Descrição</th>
                <th style="padding: 10px 16px; text-align: center; color: #64748b; width: 80px;">Qtd</th>
                <th style="padding: 10px 16px; text-align: right; color: #64748b; width: 110px;">Preço Un.</th>
                <th style="padding: 10px 16px; text-align: right; color: #64748b; width: 110px;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${partsList.map((part: any) => {
                const subtotal = part.quantity * (part.unit_price || 0);
                return `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 16px; color: #334155; font-weight: 500;">${part.part_name}</td>
                    <td style="padding: 10px 16px; text-align: center; color: #334155; font-weight: bold;">${part.quantity}</td>
                    <td style="padding: 10px 16px; text-align: right; color: #475569;">R$ ${(part.unit_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td style="padding: 10px 16px; text-align: right; color: #0f172a; font-weight: bold;">R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `;
              }).join('')}
              <tr style="background-color: #f8fafc; font-weight: bold;">
                <td colspan="3" style="padding: 12px 16px; text-align: right; color: #475569;">Total Geral de Peças:</td>
                <td style="padding: 12px 16px; text-align: right; color: #000000; font-size: 14px;">
                  R$ ${(os.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // Build Photos HTML
    let photosHtml = '';
    const photosList = photos || [];
    if (photosList.length > 0) {
      photosHtml = `
        <div style="margin-top: 25px;">
          <h4 style="color: ${primaryColor}; font-size: 14px; margin-bottom: 12px; font-weight: bold; text-transform: uppercase;">📸 Registro Fotográfico do Pátio</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
            ${photosList.map((photo: any, index: number) => `
              <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff; text-align: center; padding: 5px;">
                <img src="${photo.photo_url}" alt="Foto ${index + 1}" style="width: 100%; max-height: 180px; object-fit: cover; border-radius: 4px; display: block;" />
                <div style="font-size: 10px; color: #64748b; margin-top: 6px;">Foto registrada em ${formatDate(photo.created_at)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Build Signature HTML
    let signatureHtml = '';
    if (os.vibe_signature) {
      signatureHtml = `
        <div style="margin-top: 25px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; text-align: center; max-width: 320px;">
          <h4 style="color: #64748b; font-size: 11px; text-transform: uppercase; margin: 0 0 10px 0; font-weight: bold;">Assinatura Digital de Validação</h4>
          <img src="${os.vibe_signature}" alt="Assinatura Digital" style="width: 100%; max-height: 80px; object-fit: contain; margin: 0 auto;" />
          <div style="border-top: 1px solid #e2e8f0; margin-top: 10px; padding-top: 5px; font-size: 10px; color: #64748b;">
            Confirmado pelo Cliente / Gestor Responsável em ${formatDate(os.check_out_at || os.updated_at)}
          </div>
        </div>
      `;
    }

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Relatório de OS Concluído</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f7; margin: 0; padding: 20px; color: #334155;">
        <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- BRAND HEADER -->
          <div style="background-color: ${primaryColor}; padding: 24px; text-align: center; border-bottom: 4px solid ${accentColor};">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase;">
              PD Manutenção de Empilhadeiras
            </h1>
            <p style="color: ${accentColor}; margin: 4px 0 0 0; font-family: monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; font-weight: bold;">
              Relatório de Atendimento Técnico
            </p>
          </div>

          <!-- MAIN HEADER STATUS -->
          <div style="padding: 24px; border-bottom: 1px solid #f1f5f9; text-align: center; background-color: #fafbfc;">
            <span style="background-color: #eceff1; border: 1px solid #b0bec5; color: #37474f; font-weight: bold; font-family: monospace; padding: 4px 8px; border-radius: 4px; font-size: 11px; display: inline-block;">
              CÓDIGO OS: ${os.id.toUpperCase()}
            </span>
            <h2 style="color: ${successColor}; margin: 12px 0 4px 0; font-size: 18px; font-weight: 800; text-transform: uppercase;">
              Manutenção Concluída
            </h2>
            <p style="margin: 0; font-size: 12px; color: #64748b;">
              Atendimento encerrado em ${formatDate(os.check_out_at || os.updated_at)}
            </p>
          </div>

          <div style="padding: 24px;">
            <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
              Olá, <strong>${customerName}</strong>. Gostaríamos de informar que o serviço de manutenção corretiva/preventiva cadastrado sob o título <strong>"${os.title}"</strong> foi concluído com sucesso por nossa equipe. Segue o detalhamento completo dos serviços executados para seu arquivamento e auditoria:
            </p>

            <!-- INFOS GRID CONTAINER -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
              <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: bold; width: 130px; text-transform: uppercase; font-size: 11px;">Cliente:</td>
                  <td style="padding: 4px 0; color: #1e293b; font-weight: bold;">${customerName}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 11px;">CNPJ/CPF:</td>
                  <td style="padding: 4px 0; color: #1e293b;">${customer?.tax_id || '—'}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 11px;">Equipamento:</td>
                  <td style="padding: 4px 0; color: #1e293b; font-weight: bold;">${machine ? `${machine.brand} ${machine.model}` : '—'}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 11px;">Nº de Série / ID:</td>
                  <td style="padding: 4px 0; color: #1e293b; font-family: monospace;">${machine?.serial_number || '—'} ${machine?.internal_id ? `(ID: ${machine.internal_id})` : ''}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 11px;">Horímetro:</td>
                  <td style="padding: 4px 0; color: #1e293b;">${os.hour_meter_at_service || machine?.current_hour_meter || '0'} Horas</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 11px;">Horas Trabalhadas:</td>
                  <td style="padding: 4px 0; color: #1e293b;">${os.work_hours || '0'} Horas técnicas</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 11px;">Check-In / Out:</td>
                  <td style="padding: 4px 0; color: #1e293b; font-size: 11px;">
                    Entrada: ${formatDate(os.check_in_at)}<br>
                    Saída: ${formatDate(os.check_out_at)}
                  </td>
                </tr>
              </table>
            </div>

            <!-- DESCRIPTION -->
            <div style="margin-bottom: 25px;">
              <h4 style="color: ${primaryColor}; font-size: 14px; margin: 0 0 8px 0; font-weight: bold; text-transform: uppercase;">Descrição Técnico-Operacional</h4>
              <p style="background-color: #f1f5f9; border-left: 4px solid #94a3b8; padding: 12px 16px; margin: 0; font-size: 13px; line-height: 1.6; color: #334155; border-radius: 0 8px 8px 0; font-family: monospace; white-space: pre-line;">
                ${os.technical_notes || os.description || 'Nenhum detalhe adicional inserido.'}
              </p>
            </div>

            <!-- CHECKLIST EXTRAS -->
            ${checklistHtml}

            <!-- USED PARTS EXTRAS -->
            ${partsHtml}

            <!-- PHOTO REGISTER EXTRAS -->
            ${photosHtml}

            <!-- VALIDADOR ASSINATURA -->
            ${signatureHtml}

          </div>

          <!-- FOOTER BLOCK -->
          <div style="background-color: #fafbfc; padding: 24px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #64748b;">
            <p style="margin: 0 0 6px 0;">Este e-mail é um demonstrativo imediato gerado pelo encerramento de ordem de pátio.</p>
            <p style="margin: 0; font-weight: bold; color: ${primaryColor};">PD MANUTENÇÃO DE EMPILHADEIRAS S.A.</p>
          </div>

        </div>
      </body>
      </html>
    `;

    // Compose plain text fallback
    const textBody = `
      PD MANUTENÇÃO - REPORT DE MANUTENÇÃO CONCLUÍDO
      OS: ${os.id.toUpperCase()}
      Status: Concluído
      Encerramento: ${formatDate(os.check_out_at || os.updated_at)}

      Olá, ${customerName}.
      O serviço "${os.title}" foi finalizado com sucesso.

      DETALHES:
      - Cliente: ${customerName}
      - Equipamento: ${machine ? `${machine.brand} ${machine.model}` : '—'}
      - Série: ${machine?.serial_number || '—'}
      - Horímetro no Atendimento: ${os.hour_meter_at_service || '—'} h
      - Horas de Operação: ${os.work_hours || 0} h

      MOTIVO/OBSERVAÇÃO TÉCNICA:
      ${os.technical_notes || os.description || 'Sem notas técnico-operacionais adicionais.'}

      Total Geral em Peças: R$ ${(os.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

      Agradecemos pela parceria!
      PD MANUTENÇÃO DE EMPILHADEIRAS S.A.
    `;

    // 7. Send real email using Gmail Google Apps Script Web App
    let emailStatus: 'sent' | 'failed' = 'sent';
    const rawGmailScriptUrl = import.meta.env.VITE_GMAIL_SCRIPT_URL || '';
    const gmailScriptUrl = rawGmailScriptUrl.trim();

    if (gmailScriptUrl) {
      try {
        console.log(`[EmailService] Attempting to deliver email via Gmail Apps Script to: ${recipient}...`);

        // Send payload. When using mode: 'no-cors' standard custom headers are omitted.
        // We do not set application/json custom header to ensure browsers do not block, and let text/plain allow sending raw payload.
        await fetch(gmailScriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({
            to: recipient,
            subject: subject,
            htmlBody: htmlBody,
            fromName: 'PD Manutenção'
          })
        });

        console.log(`[EmailService] Gmail Apps Script email service dispatched successfully to ${recipient} (opaque fire-and-forget).`);
      } catch (sendErr: any) {
        console.error('[EmailService] Failed to send email via Gmail Apps Script:', sendErr);
        emailStatus = 'failed';
      }
    } else {
      console.log('[EmailService] VITE_GMAIL_SCRIPT_URL is not defined. Email dispatch simulated.');
    }

    // 8. Write email send record to Firestore (persistent logs)
    const emailLogPayload: Omit<EmailLog, 'id'> = {
      service_order_id: orderId,
      recipient_email: recipient,
      customer_name: customerName,
      subject: subject,
      html_body: htmlBody,
      text_body: textBody,
      status: emailStatus,
      sent_at: new Date().toISOString()
    };

    const { data: insertedList, error: insertError } = await supabase
      .from('email_logs')
      .insert([emailLogPayload]);

    if (insertError) {
      console.error('[EmailService] Error inserting email log:', insertError);
    }

    const createdRecord = (insertedList && insertedList[0]) || {
      id: 'email-' + Math.random().toString(36).substring(2, 9),
      ...emailLogPayload
    };

    return {
      success: emailStatus === 'sent',
      data: createdRecord as EmailLog,
      error: emailStatus === 'failed' ? 'Erro de comunicação com o servidor de e-mail (Gmail Script).' : undefined
    };
  } catch (err: any) {
    console.error('[EmailService] Error preparing report:', err);
    return {
      success: false,
      error: err.message || 'Erro desconhecido ao estruturar relatório de email.'
    };
  }
}
