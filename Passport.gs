/**
 * Passport.gs — EduVenture Passport (สะสมสติกเกอร์ 6 บูธ)
 *
 * กฎสำคัญ: สะสมสติกเกอร์แยกอิสระจากการโหวต
 * ครบ 6 → ปลดล็อก Reflection (ไม่ตรวจ hasVoted)
 */

/**
 * เพิ่มสติกเกอร์ให้ผู้เข้าร่วม (ผู้ดูแลบูธสแกน/กด)
 * boothId: รหัสบูธ เช่น 'booth1'
 */
function addSticker(lineUserId, boothId) {
  const participant = findParticipantByLineId(lineUserId);
  if (!participant) return { ok: false, reason: 'NOT_FOUND' };
  if (!participant.eventActivated) return { ok: false, reason: 'NOT_ACTIVATED' };

  let booths = participant.stickerBooths
    ? String(participant.stickerBooths).split(',').filter(String)
    : [];

  // กันสติกเกอร์ซ้ำบูธเดิม
  if (booths.indexOf(boothId) > -1) {
    return { ok: false, reason: 'ALREADY_HAS_STICKER', count: booths.length };
  }

  booths.push(boothId);
  const count = booths.length;

  updateParticipantField(lineUserId, 'stickerBooths', booths.join(','));
  updateParticipantField(lineUserId, 'stickerCount', count);

  // ครบ 6 → ปลดล็อก Reflection (ไม่เกี่ยวกับ hasVoted)
  if (count >= CONFIG.REQUIRED_STICKERS) {
    updateParticipantField(lineUserId, 'reflectionUnlocked', true);
    updateParticipantField(lineUserId, 'passportReceived', true);
    pushMessage(lineUserId, {
      type: 'text',
      text: 'ยินดีด้วย! ท่านสะสมสติกเกอร์ครบ ' + CONFIG.REQUIRED_STICKERS +
            ' บูธแล้ว\nสามารถส่งบันทึกการเรียนรู้เพื่อรับเกียรติบัตรได้'
    });
  }

  logAudit('STICKER_ADD', lineUserId, participant.participantId,
           { boothId: boothId, count: count });
  return { ok: true, count: count };
}

/**
 * เมนู Passport → เปิดหน้าอัปโหลดรูปสมุด (LIFF passport)
 */
function handlePassportStatus(userId, replyToken) {
  const participant = findParticipantByLineId(userId);
  if (!participant || !participant.eventActivated) {
    replyMessage(replyToken, { type: 'text', text: 'กรุณายืนยันตัวตนในงานก่อน' });
    return;
  }
  const liffUrl = 'https://liff.line.me/' + CONFIG.LIFF_ID_PASSPORT +
    '?pid=' + encodeURIComponent(participant.participantId);

  const uploaded = (participant.passportReceived === true || participant.passportReceived === 'TRUE');
  replyMessage(replyToken, {
    type: 'flex',
    altText: 'EduVenture Passport',
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          { type: 'text', text: 'EduVenture Passport', weight: 'bold', size: 'md' },
          { type: 'text',
            text: 'เดินครบ ' + CONFIG.REQUIRED_STICKERS + ' บูธ รับสติกเกอร์ติดสมุดเป็นที่ระลึก ' +
                  'แล้วถ่ายรูปสมุดที่ติดครบ อัปโหลดเป็นหลักฐานที่นี่',
            size: 'xs', color: '#888888', wrap: true },
          { type: 'text',
            text: uploaded ? '✅ อัปโหลดรูปแล้ว (อัปใหม่เพื่อแก้ไขได้)' : '⬆️ ยังไม่ได้อัปโหลดรูป',
            size: 'xs', color: uploaded ? '#1DB447' : '#BA7517', wrap: true }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{
          type: 'button', style: 'primary', color: '#1DB447',
          action: { type: 'uri', label: 'อัปโหลดรูป Passport', uri: liffUrl }
        }]
      }
    }
  });
}

/**
 * บันทึกรูปสมุด Passport (เรียกจาก LIFF passport ผ่าน Api.gs)
 * payload: { lineUserId (ยืนยันแล้ว), passportPhotoBase64, photoMimeType }
 */
function liffSavePassportPhoto(payload) {
  const participant = findParticipantByLineId(payload.lineUserId);
  if (!participant) return { ok: false, reason: 'NOT_FOUND' };
  if (!participant.eventActivated) return { ok: false, reason: 'NOT_ACTIVATED' };
  if (!payload.passportPhotoBase64) return { ok: false, reason: 'MISSING_PHOTO' };

  const url = uploadPassportPhoto(
    participant.queueNumber,
    payload.passportPhotoBase64,
    payload.photoMimeType || 'image/jpeg'
  );

  updateParticipantField(payload.lineUserId, 'passportPhotoUrl', url);
  updateParticipantField(payload.lineUserId, 'passportReceived', true);
  logAudit('PASSPORT_PHOTO', payload.lineUserId, participant.participantId, {});

  return { ok: true, photoUrl: url };
}
