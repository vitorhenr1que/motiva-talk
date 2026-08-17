import { AppError } from '@/lib/api-errors'

type VerificationMethod = 'SMS' | 'VOICE'

interface MetaErrorPayload {
  error?: {
    code?: number
    error_subcode?: number
    message?: string
    error_data?: {
      details?: string
    }
  }
}

export interface MetaPhoneNumber {
  id: string
  display_phone_number?: string
  verified_name?: string
  code_verification_status?: string
  platform_type?: string
  status?: string
}

interface MetaPhoneNumberList {
  data?: MetaPhoneNumber[]
}

interface MetaCreatePhoneNumberResponse {
  id?: string
  success?: boolean
}

export interface AddMetaPhoneNumberInput {
  countryCode: string
  nationalNumber: string
  displayName: string
}

function requireMetaEnvironment() {
  const accessToken = process.env.META_ACCESS_TOKEN?.trim()
  const wabaId = process.env.META_WABA_ID?.trim()

  if (!accessToken) {
    throw new AppError(
      'A integração da Meta ainda não possui META_ACCESS_TOKEN no servidor.',
      503,
      'VALIDATION_ERROR'
    )
  }

  if (!wabaId) {
    throw new AppError(
      'A integração da Meta ainda não possui META_WABA_ID no servidor.',
      503,
      'VALIDATION_ERROR'
    )
  }

  return {
    accessToken,
    wabaId,
    graphVersion: process.env.META_GRAPH_API_VERSION?.trim() || 'v26.0',
  }
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '')
}

function metaErrorMessage(payload: MetaErrorPayload, fallback: string) {
  const details = payload.error?.error_data?.details?.trim()
  const message = payload.error?.message?.trim()
  return details || message || fallback
}

async function graphRequest<T>(
  path: string,
  init: RequestInit = {},
  fallbackMessage = 'A Meta não conseguiu concluir a solicitação.'
): Promise<T> {
  const { accessToken, graphVersion } = requireMetaEnvironment()
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  const payload = (await response.json().catch(() => ({}))) as T & MetaErrorPayload
  if (!response.ok || payload.error) {
    const message = metaErrorMessage(payload, fallbackMessage)
    const code = payload.error?.code
    const subcode = payload.error?.error_subcode

    throw new AppError(message, response.status >= 500 ? 502 : 400, 'VALIDATION_ERROR', {
      provider: 'META',
      code,
      subcode,
    })
  }

  return payload
}

export class MetaChannelOnboardingService {
  static getWabaId() {
    return requireMetaEnvironment().wabaId
  }

  static normalizePhone(countryCode: string, nationalNumber: string) {
    const cc = normalizeDigits(countryCode)
    const phone = normalizeDigits(nationalNumber)

    if (!cc || cc.length > 3 || cc.startsWith('0')) {
      throw new AppError('Informe um DDI válido.', 400, 'VALIDATION_ERROR')
    }

    if (!phone || phone.length < 7 || phone.length > 14 || phone.startsWith('0')) {
      throw new AppError('Informe um número de telefone válido, com DDD e sem o DDI.', 400, 'VALIDATION_ERROR')
    }

    const e164Digits = `${cc}${phone}`
    if (e164Digits.length > 15) {
      throw new AppError('O número informado excede o limite do formato internacional E.164.', 400, 'VALIDATION_ERROR')
    }

    return { countryCode: cc, nationalNumber: phone, e164Digits }
  }

  static phoneNumbersMatch(left: string, right: string) {
    const first = normalizeDigits(left)
    const second = normalizeDigits(right)
    if (first === second) return true

    const withoutBrazilianNinthDigit = (phone: string) => {
      // 55 + DDD (2) + 9 + número móvel (8). A Meta pode omitir esse nono dígito.
      if (/^55\d{2}9[6-9]\d{7}$/.test(phone)) {
        return `${phone.slice(0, 4)}${phone.slice(5)}`
      }
      return phone
    }

    return withoutBrazilianNinthDigit(first) === withoutBrazilianNinthDigit(second)
  }

  static async listPhoneNumbers() {
    const { wabaId } = requireMetaEnvironment()
    return this.listPhoneNumbersForWaba(wabaId)
  }

  static async listPhoneNumbersForWaba(wabaId: string) {
    const normalizedWabaId = wabaId.trim()
    if (!/^\d+$/.test(normalizedWabaId)) {
      throw new AppError('O identificador da conta do WhatsApp é inválido.', 400, 'VALIDATION_ERROR')
    }

    const fields = [
      'id',
      'display_phone_number',
      'verified_name',
      'code_verification_status',
      'platform_type',
      'status',
    ].join(',')
    const payload = await graphRequest<MetaPhoneNumberList>(
      `${normalizedWabaId}/phone_numbers?fields=${encodeURIComponent(fields)}&limit=100`,
      {},
      'Não foi possível consultar os números desta conta do WhatsApp.'
    )
    return payload.data || []
  }

  static async findPhoneNumber(e164Digits: string) {
    const numbers = await this.listPhoneNumbers()
    return numbers.find((item) => this.phoneNumbersMatch(item.display_phone_number || '', e164Digits)) || null
  }

  static async ensurePhoneNumber(input: AddMetaPhoneNumberInput) {
    const normalized = this.normalizePhone(input.countryCode, input.nationalNumber)
    const existing = await this.findPhoneNumber(normalized.e164Digits)
    if (existing) return existing

    const { wabaId } = requireMetaEnvironment()
    const displayName = input.displayName.trim()
    if (displayName.length < 3 || displayName.length > 60) {
      throw new AppError('O nome exibido na Meta deve ter entre 3 e 60 caracteres.', 400, 'VALIDATION_ERROR')
    }

    const created = await graphRequest<MetaCreatePhoneNumberResponse>(
      `${wabaId}/phone_numbers`,
      {
        method: 'POST',
        body: JSON.stringify({
          cc: normalized.countryCode,
          phone_number: normalized.nationalNumber,
          verified_name: displayName,
        }),
      },
      'A Meta não conseguiu adicionar este número à conta do WhatsApp.'
    )

    if (created.id) {
      return {
        id: created.id,
        display_phone_number: normalized.e164Digits,
        verified_name: displayName,
      } satisfies MetaPhoneNumber
    }

    const attached = await this.findPhoneNumber(normalized.e164Digits)
    if (!attached) {
      throw new AppError(
        'A Meta aceitou a solicitação, mas ainda não disponibilizou o identificador do número. Tente novamente em instantes.',
        409,
        'CONFLICT'
      )
    }

    return attached
  }

  static async requestVerificationCode(phoneNumberId: string, method: VerificationMethod) {
    const requestCode = (languageField: 'language' | 'locale') =>
      graphRequest<{ success?: boolean }>(
        `${phoneNumberId}/request_code`,
        {
          method: 'POST',
          body: JSON.stringify({ code_method: method, [languageField]: 'pt_BR' }),
        },
        `Não foi possível enviar o código por ${method === 'SMS' ? 'SMS' : 'ligação'}.`
      )

    try {
      // A Graph API v26 exige `language` para números PENDING/NOT_VERIFIED.
      return await requestCode('language')
    } catch (error) {
      // Algumas versões antigas da Cloud API documentam o mesmo campo como `locale`.
      if (error instanceof Error && /parameter locale is required/i.test(error.message)) {
        return requestCode('locale')
      }
      throw error
    }
  }

  static async getPhoneNumber(phoneNumberId: string) {
    const fields = [
      'id',
      'display_phone_number',
      'verified_name',
      'code_verification_status',
      'platform_type',
      'status',
    ].join(',')
    return graphRequest<MetaPhoneNumber>(
      `${phoneNumberId}?fields=${encodeURIComponent(fields)}`,
      {},
      'Não foi possível consultar o número na Meta.'
    )
  }

  static async completeRegistration(phoneNumberId: string, code: string, pin: string) {
    const before = await this.getPhoneNumber(phoneNumberId)

    if (before.code_verification_status !== 'VERIFIED') {
      await graphRequest<{ success?: boolean }>(
        `${phoneNumberId}/verify_code`,
        {
          method: 'POST',
          body: JSON.stringify({ code }),
        },
        'O código informado não foi aceito pela Meta.'
      )
    }

    const isCloudApi = before.platform_type === 'CLOUD_API' && before.status === 'CONNECTED'
    if (!isCloudApi) {
      await graphRequest<{ success?: boolean }>(
        `${phoneNumberId}/register`,
        {
          method: 'POST',
          body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
        },
        'O número foi verificado, mas não pôde ser registrado na Cloud API.'
      )
    }

    const { wabaId } = requireMetaEnvironment()
    await this.subscribeWaba(wabaId)

    return this.getPhoneNumber(phoneNumberId)
  }

  static async subscribeWaba(wabaId: string) {
    const normalizedWabaId = wabaId.trim()
    if (!/^\d+$/.test(normalizedWabaId)) {
      throw new AppError('O identificador da conta do WhatsApp é inválido.', 400, 'VALIDATION_ERROR')
    }

    await graphRequest<{ success?: boolean }>(
      `${normalizedWabaId}/subscribed_apps`,
      { method: 'POST' },
      'O número foi registrado, mas o app não pôde assinar os webhooks da conta.'
    )
  }
}
